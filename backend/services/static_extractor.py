"""
Trixon Backend — Static Code Extractor Service

Pure-Python static analysis of a repository's file tree.
No AI involved — this extracts factual, deterministic information
about languages, frameworks, dependencies, API routes, env vars,
third-party services, and database models.
"""

import json
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# -----------------------------------------------
# Known third-party services (matched against imports/env vars)
# -----------------------------------------------
KNOWN_SERVICES = {
    "stripe": "Stripe (Payments)",
    "openai": "OpenAI",
    "anthropic": "Anthropic Claude",
    "google-generativeai": "Google Gemini",
    "google.generativeai": "Google Gemini",
    "google.genai": "Google Gemini",
    "supabase": "Supabase",
    "twilio": "Twilio (SMS/Voice)",
    "sendgrid": "SendGrid (Email)",
    "resend": "Resend (Email)",
    "clerk": "Clerk (Auth)",
    "@clerk": "Clerk (Auth)",
    "auth0": "Auth0",
    "@auth0": "Auth0",
    "sentry": "Sentry (Error Tracking)",
    "@sentry": "Sentry (Error Tracking)",
    "datadog": "Datadog",
    "vercel": "Vercel",
    "@vercel": "Vercel",
    "cloudflare": "Cloudflare",
    "aws-sdk": "AWS",
    "boto3": "AWS (boto3)",
    "firebase": "Firebase",
    "firebase-admin": "Firebase Admin",
    "mongodb": "MongoDB",
    "mongoose": "Mongoose (MongoDB)",
    "prisma": "Prisma ORM",
    "@prisma": "Prisma ORM",
    "drizzle-orm": "Drizzle ORM",
    "typeorm": "TypeORM",
    "sequelize": "Sequelize ORM",
    "sqlalchemy": "SQLAlchemy",
    "alembic": "Alembic (DB Migrations)",
    "celery": "Celery (Task Queue)",
    "redis": "Redis",
    "elasticsearch": "Elasticsearch",
    "pinecone": "Pinecone (Vector DB)",
    "weaviate": "Weaviate (Vector DB)",
    "langchain": "LangChain",
    "posthog": "PostHog (Analytics)",
    "mixpanel": "Mixpanel",
    "intercom": "Intercom",
    "hubspot": "HubSpot",
    "plaid": "Plaid (Banking)",
    "shopify": "Shopify",
    "pusher": "Pusher (WebSockets)",
    "socket.io": "Socket.IO",
    "neon": "Neon DB",
    "planetscale": "PlanetScale",
    "upstash": "Upstash",
}

# -----------------------------------------------
# Framework detection rules
# -----------------------------------------------
FRAMEWORK_SIGNALS = [
    # (framework_name, list_of_file_or_content_indicators)
    ("Next.js", ["next.config.js", "next.config.ts", "next.config.mjs"]),
    ("Nuxt.js", ["nuxt.config.js", "nuxt.config.ts"]),
    ("SvelteKit", ["svelte.config.js"]),
    ("Remix", ["remix.config.js"]),
    ("Vite", ["vite.config.js", "vite.config.ts"]),
    ("FastAPI", ["fastapi"]),  # matched against imports/deps
    ("Django", ["django"]),
    ("Flask", ["flask"]),
    ("Express.js", ["express"]),
    ("NestJS", ["@nestjs/core"]),
    ("Rails", ["config/routes.rb"]),
    ("Laravel", ["artisan"]),
    ("Spring Boot", ["pom.xml"]),
    ("Go (Gin)", ["go.mod"]),
]

# File extension → language name
EXT_TO_LANG = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".swift": "Swift",
    ".dart": "Dart",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SCSS",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".sh": "Shell",
    ".bash": "Shell",
    ".dockerfile": "Docker",
}

# Route detection patterns (regex)
ROUTE_PATTERNS = [
    # Python FastAPI / Flask / Django
    r'@(?:app|router|blueprint)\.(get|post|put|patch|delete|options)\(["\']([^"\']+)',
    r'path\(["\']([^"\']+)',
    r'url\(["\']([^"\']+)',
    # Express / Node.js
    r'(?:app|router)\.(get|post|put|patch|delete)\(["\']([^"\']+)',
    # Next.js App Router
    r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)',
    # Next.js Pages API
    r'export\s+default\s+(?:async\s+)?function\s+handler',
]

# Env var patterns
ENV_VAR_PATTERNS = [
    r'process\.env\.([A-Z_][A-Z0-9_]+)',
    r'os\.environ(?:\.get)?\(["\']([A-Z_][A-Z0-9_]+)',
    r'os\.getenv\(["\']([A-Z_][A-Z0-9_]+)',
    r'import\.meta\.env\.([A-Z_][A-Z0-9_]+)',
    r'Deno\.env\.get\(["\']([A-Z_][A-Z0-9_]+)',
]


@dataclass
class ExtractionResult:
    """Full result of static analysis on a repository."""
    language_breakdown: dict[str, int] = field(default_factory=dict)   # {lang: line_count}
    frameworks: list[str] = field(default_factory=list)
    dependencies: dict[str, list[str]] = field(default_factory=dict)   # {source_file: [dep_list]}
    api_routes: list[str] = field(default_factory=list)
    env_vars_referenced: list[str] = field(default_factory=list)
    third_party_services: list[str] = field(default_factory=list)
    db_models_detected: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)  # total_files, total_lines, etc.
    key_files: dict[str, str] = field(default_factory=dict)   # {path: content} for AI context

    # --- v3.1 additions: per-report file selectors ---
    readme_path: str | None = None                    # e.g. "README.md"
    entry_point_files: list[str] = field(default_factory=list)  # main.py, app.py, index.ts, etc.
    largest_files: list[str] = field(default_factory=list)      # top 5 by line count
    most_complex_files: list[str] = field(default_factory=list) # top 5 by function count
    files_with_env_usage: list[str] = field(default_factory=list)  # files referencing env vars
    auth_related_files: list[str] = field(default_factory=list)    # auth/middleware/login paths
    db_query_files: list[str] = field(default_factory=list)        # ORM/SQL query patterns
    file_tree_compact: list[str] = field(default_factory=list)     # paths only, depth ≤ 3


def extract(files: dict[str, str]) -> ExtractionResult:
    """
    Run all static extractors on the provided file map.

    Args:
        files: Dict mapping file paths to their text content

    Returns:
        ExtractionResult with all findings
    """
    result = ExtractionResult()

    lang_lines: dict[str, int] = defaultdict(int)
    all_deps: list[str] = []
    all_routes: list[str] = []
    all_env_vars: set[str] = set()
    all_services: set[str] = set()
    db_signals: set[str] = set()
    framework_signals_found: set[str] = set()

    total_files = 0
    total_lines = 0

    for path, content in files.items():
        total_files += 1
        lines = content.splitlines()
        total_lines += len(lines)

        # --- Language detection ---
        if _should_count_for_language(path):
            ext = _get_extension(path)
            lang = EXT_TO_LANG.get(ext)
            if lang:
                lang_lines[lang] += len(lines)

        # --- Framework detection by filename ---
        filename = path.split("/")[-1]
        for fw_name, signals in FRAMEWORK_SIGNALS:
            for sig in signals:
                if sig in path or sig == filename:
                    framework_signals_found.add(fw_name)

        # --- Dependency parsing ---
        deps = _extract_dependencies(path, content)
        if deps:
            all_deps.extend(deps)
            # Framework detection from deps
            for dep in deps:
                dep_lower = dep.lower()
                for fw_name, signals in FRAMEWORK_SIGNALS:
                    for sig in signals:
                        if dep_lower.startswith(sig.lower()):
                            framework_signals_found.add(fw_name)

        # --- API route detection ---
        routes = _extract_routes(path, content)
        all_routes.extend(routes)

        # --- Env var scanning ---
        env_vars = _extract_env_vars(content)
        all_env_vars.update(env_vars)

        # --- Third-party service detection ---
        services = _detect_services(path, content, deps)
        all_services.update(services)

        # --- DB model detection ---
        db = _detect_db_models(path, content)
        db_signals.update(db)

        # --- Select key files for AI context ---
        _maybe_add_key_file(result, path, content)

    # Compute language breakdown as percentages
    total_lang_lines = sum(lang_lines.values()) or 1
    result.language_breakdown = {
        lang: round((count / total_lang_lines) * 100, 1)
        for lang, count in sorted(lang_lines.items(), key=lambda x: -x[1])
        if count > 0
    }

    result.frameworks = sorted(framework_signals_found)
    result.dependencies = {"all": sorted(set(all_deps))}
    result.api_routes = sorted(set(all_routes))
    result.env_vars_referenced = sorted(all_env_vars)
    result.third_party_services = sorted(all_services)
    result.db_models_detected = sorted(db_signals)
    result.stats = {
        "total_files": total_files,
        "total_lines": total_lines,
        "total_endpoints": len(result.api_routes),
        "total_dependencies": len(set(all_deps)),
        "env_vars_count": len(all_env_vars),
    }

    # --- v3.1: Populate per-report file selectors ---
    _populate_v31_fields(result, files)

    return result


# -----------------------------------------------
# Private helper functions
# -----------------------------------------------

def _get_extension(path: str) -> str:
    """Get the file extension (lowercased) from a path."""
    dot = path.rfind(".")
    if dot == -1:
        filename = path.split("/")[-1].lower()
        if "dockerfile" in filename:
            return ".dockerfile"
        return ""
    return path[dot:].lower()

# Files that should not count toward language breakdown
EXCLUDED_FILE_PATTERNS = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "composer.lock",
    "poetry.lock",
    "Gemfile.lock",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.d.ts",  # TypeScript declaration files — not source
}

# JSON files that ARE meaningful source (include them)
JSON_SOURCE_PATTERNS = {
    "schema.json",
    "manifest.json",
    "openapi.json",
    "swagger.json",
}

def _should_count_for_language(filepath: str) -> bool:
    """Returns True if this file should be counted in language breakdown."""
    name = filepath.split("/")[-1].lower()
    ext = _get_extension(filepath)

    # Check exact match exclusions
    if name in EXCLUDED_FILE_PATTERNS:
        return False
    
    # Check wildcard exclusions (*.min.js, etc.)
    for pattern in EXCLUDED_FILE_PATTERNS:
        if pattern.startswith("*") and name.endswith(pattern[1:]):
            return False

    # JSON: only count if it's a known source schema, not arbitrary config
    if ext == ".json":
        return any(name.endswith(p) for p in JSON_SOURCE_PATTERNS)

    return True


def _extract_dependencies(path: str, content: str) -> list[str]:
    """Parse dependency files and return list of dependency names."""
    filename = path.split("/")[-1]

    if filename == "package.json":
        try:
            data = json.loads(content)
            deps = list(data.get("dependencies", {}).keys())
            deps += list(data.get("devDependencies", {}).keys())
            return deps
        except (json.JSONDecodeError, Exception):
            return []

    if filename == "requirements.txt":
        lines = []
        for line in content.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                # Strip version specifiers
                name = re.split(r"[>=<!~\[]", line)[0].strip()
                if name:
                    lines.append(name)
        return lines

    if filename == "pyproject.toml":
        deps = []
        in_deps = False
        for line in content.splitlines():
            if "[tool.poetry.dependencies]" in line or "[project]" in line:
                in_deps = True
            elif line.strip().startswith("[") and in_deps:
                in_deps = False
            elif in_deps:
                match = re.match(r'^([a-zA-Z0-9\-_]+)\s*[=<>!~]', line)
                if match:
                    deps.append(match.group(1))
        return deps

    if filename == "go.mod":
        deps = []
        for line in content.splitlines():
            match = re.match(r'\s+([\w./\-]+)\s+v', line)
            if match:
                deps.append(match.group(1).split("/")[-1])
        return deps

    return []


def _extract_routes(path: str, content: str) -> list[str]:
    """Scan file content for API route definitions."""
    routes = []
    for pattern in ROUTE_PATTERNS:
        for match in re.finditer(pattern, content, re.MULTILINE):
            groups = [g for g in match.groups() if g]
            if groups:
                route = " ".join(groups)
                routes.append(f"{path}: {route}")
    return routes


def _extract_env_vars(content: str) -> set[str]:
    """Scan file content for referenced environment variable names."""
    env_vars = set()
    for pattern in ENV_VAR_PATTERNS:
        for match in re.finditer(pattern, content):
            var_name = match.group(1)
            if len(var_name) > 2:  # Skip single/double letter vars
                env_vars.add(var_name)
    return env_vars


def _detect_services(path: str, content: str, deps: list[str]) -> set[str]:
    """Detect third-party services from imports and dependency names."""
    found = set()
    content_lower = content.lower()

    all_identifiers = list(deps) + [path]

    for identifier in all_identifiers:
        id_lower = identifier.lower()
        for key, service_name in KNOWN_SERVICES.items():
            if key.lower() in id_lower:
                found.add(service_name)

    # Also scan content for import statements
    for key, service_name in KNOWN_SERVICES.items():
        if re.search(rf'(?:import|require|from)\s+["\']?{re.escape(key)}', content_lower):
            found.add(service_name)

    return found


def _detect_db_models(path: str, content: str) -> set[str]:
    """Detect database model patterns."""
    found = set()
    filename = path.split("/")[-1]

    if filename == "schema.prisma" or path.endswith(".prisma"):
        found.add("Prisma Schema")

    if re.search(r'class\s+\w+\s*\(\s*(?:db\.Model|Base|Model)\s*\)', content):
        found.add("SQLAlchemy Models")

    if "models.py" in path and re.search(r'class\s+\w+\s*\(\s*models\.Model\s*\)', content):
        found.add("Django Models")

    if re.search(r'pgTable|mysqlTable|sqliteTable', content):
        found.add("Drizzle ORM Schema")

    if re.search(r'@Entity\(\)', content) or re.search(r'@Table\(', content):
        found.add("TypeORM Entities")

    return found


def _maybe_add_key_file(result: ExtractionResult, path: str, content: str) -> None:
    """Add important files to the key_files dict for AI context building."""
    MAX_KEY_FILE_CHARS = 8000
    filename = path.split("/")[-1].lower()

    key_filenames = {
        "readme.md", "readme.txt", "readme.rst",
        "package.json", "requirements.txt", "pyproject.toml",
        "schema.prisma", "models.py", "schema.sql",
        "next.config.js", "next.config.ts",
        "main.py", "app.py", "server.py", "index.ts", "index.js",
        "app.ts", "app.js", "server.ts",
        "docker-compose.yml", "dockerfile",
    }

    is_route_file = any(
        x in path.lower() for x in ["routes/", "api/", "controllers/", "handlers/", "pages/api/"]
    )

    is_key = filename in key_filenames or is_route_file

    if is_key and len(result.key_files) < 30:
        result.key_files[path] = content[:MAX_KEY_FILE_CHARS]


# -----------------------------------------------
# v3.1: Per-report file selector population
# -----------------------------------------------

ENTRY_POINT_NAMES = {
    "main.py", "app.py", "server.py", "app.ts", "server.ts",
    "index.ts", "index.js", "main.ts", "app.js",
    "layout.tsx", "layout.ts",  # Next.js root layout
}

AUTH_SIGNALS = ["auth", "middleware", "login", "signup", "session", "jwt", "oauth", "token"]
DB_QUERY_SIGNALS = ["query", "db.", "supabase", "prisma", "sqlalchemy", "drizzle", "mongoose"]


def _populate_v31_fields(result: ExtractionResult, files: dict[str, str]) -> None:
    """
    Populate the v3.1 per-report file selector fields on ExtractionResult.
    Called once per extraction run.
    """
    # File line counts for largest_files
    file_line_counts: list[tuple[int, str]] = []
    # Function count per file for most_complex_files
    file_fn_counts: list[tuple[int, str]] = []
    # Compact file tree (depth ≤ 3 directories)
    tree_paths: set[str] = set()

    for path, content in files.items():
        filename = path.split("/")[-1].lower()
        path_lower = path.lower()
        lines = content.splitlines()
        line_count = len(lines)

        # README detection
        if filename in {"readme.md", "readme.txt", "readme.rst"} and result.readme_path is None:
            result.readme_path = path

        # Entry points
        if filename in ENTRY_POINT_NAMES and path not in result.entry_point_files:
            result.entry_point_files.append(path)

        # Files with env var usage
        if any(re.search(p, content) for p in ENV_VAR_PATTERNS):
            result.files_with_env_usage.append(path)

        # Auth-related files
        if any(sig in path_lower for sig in AUTH_SIGNALS):
            result.auth_related_files.append(path)

        # DB query files
        if any(sig in content.lower() for sig in DB_QUERY_SIGNALS):
            result.db_query_files.append(path)

        # Compact file tree (depth ≤ 3)
        parts = path.split("/")
        if len(parts) <= 4:  # file at depth ≤ 3 dirs
            tree_paths.add(path)
        elif len(parts) > 1:
            # Include the directory up to depth 3
            tree_paths.add("/".join(parts[:3]) + "/...")

        # Track for largest/most-complex
        ext = _get_extension(path)
        if ext in EXT_TO_LANG:
            file_line_counts.append((line_count, path))
            # Count function definitions as a complexity proxy
            fn_count = len(re.findall(
                r'^\s*(?:def |async def |function |const \w+ = (?:async )?(?:\([^)]*\)|\w+)\s*=>)',
                content, re.MULTILINE
            ))
            file_fn_counts.append((fn_count, path))

    # Sort and take top 5
    file_line_counts.sort(reverse=True)
    file_fn_counts.sort(reverse=True)
    result.largest_files = [p for _, p in file_line_counts[:5]]
    result.most_complex_files = [p for _, p in file_fn_counts[:5]]

    # Deduplicate and sort selector lists
    result.entry_point_files = list(dict.fromkeys(result.entry_point_files))[:6]
    result.files_with_env_usage = list(dict.fromkeys(result.files_with_env_usage))[:8]
    result.auth_related_files = list(dict.fromkeys(result.auth_related_files))[:6]
    result.db_query_files = list(dict.fromkeys(result.db_query_files))[:6]
    result.file_tree_compact = sorted(tree_paths)[:80]


# -----------------------------------------------
# v3.1: Extraction mode functions
# -----------------------------------------------

def extract_signatures(path: str, content: str) -> str:
    """
    Extract function/class signatures without bodies.
    
    For .py: uses Python ast module — deterministic, no clipping.
    For .ts/.tsx/.js/.jsx: regex-based body stripper.
    
    Returns a condensed string typically 80-90% smaller than full source.
    """
    ext = _get_extension(path)

    if ext == ".py":
        return _extract_python_signatures(content)
    elif ext in {".ts", ".tsx", ".js", ".jsx", ".mjs"}:
        return _extract_js_signatures(content)
    else:
        # For other file types, return first 30 lines (imports + top-level only)
        lines = content.splitlines()
        return "\n".join(lines[:30]) + ("\n..." if len(lines) > 30 else "")


def _extract_python_signatures(content: str) -> str:
    """
    Use Python's ast module to extract function/class signatures.
    Preserves: decorators, def/class line, docstring (if present).
    Strips: function bodies.
    """
    import ast
    lines = content.splitlines()
    output_parts: list[str] = []

    # Extract imports first
    import_lines = [
        line for line in lines
        if line.strip().startswith(("import ", "from "))
    ]
    if import_lines:
        output_parts.append("# Imports")
        output_parts.extend(import_lines[:20])  # Cap at 20 import lines
        output_parts.append("")

    try:
        tree = ast.parse(content)
    except SyntaxError:
        # Fallback: return first 40 lines
        return "\n".join(lines[:40])

    def get_docstring(node) -> str | None:
        """Get the docstring from a function/class node, if it exists."""
        if (node.body and isinstance(node.body[0], ast.Expr)
                and isinstance(node.body[0].value, ast.Constant)
                and isinstance(node.body[0].value.value, str)):
            doc = node.body[0].value.value.strip()
            # Truncate long docstrings
            if len(doc) > 200:
                doc = doc[:200] + "..."
            return doc
        return None

    def process_node(node, indent: int = 0) -> None:
        prefix = "    " * indent

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Decorators
            for decorator in node.decorator_list:
                decorator_line = lines[decorator.lineno - 1].strip()
                output_parts.append(f"{prefix}{decorator_line}")

            # Signature line
            sig_line = lines[node.lineno - 1]
            output_parts.append(sig_line)

            # Docstring
            doc = get_docstring(node)
            if doc:
                output_parts.append(f'{prefix}    """')
                output_parts.append(f"{prefix}    {doc}")
                output_parts.append(f'{prefix}    """')

            output_parts.append(f"{prefix}    ...")
            output_parts.append("")

        elif isinstance(node, ast.ClassDef):
            # Decorators
            for decorator in node.decorator_list:
                decorator_line = lines[decorator.lineno - 1].strip()
                output_parts.append(f"{prefix}{decorator_line}")

            # Class signature
            class_line = lines[node.lineno - 1]
            output_parts.append(class_line)

            # Class docstring
            doc = get_docstring(node)
            if doc:
                output_parts.append(f'{prefix}    """')
                output_parts.append(f"{prefix}    {doc}")
                output_parts.append(f'{prefix}    """')
                output_parts.append("")

            # Recurse into class body for methods
            for child in node.body:
                process_node(child, indent + 1)

            output_parts.append("")

    # Process top-level definitions only (to avoid double-processing class methods)
    for node in tree.body:
        process_node(node)

    return "\n".join(output_parts) if output_parts else "# (no function/class definitions found)"


def _extract_js_signatures(content: str) -> str:
    """
    Regex-based signature extractor for JS/TS files.
    Strips function bodies, preserves imports, exports, and signatures.
    """
    lines = content.splitlines()
    output_lines: list[str] = []

    # Include imports and type/interface definitions
    import_pattern = re.compile(
        r'^\s*(?:import |export (?:type |interface |enum )|interface |type |//)'
    )
    # Function/method signature patterns
    fn_patterns = [
        re.compile(r'^(\s*(?:export\s+)?(?:async\s+)?function\s+\w+[^{]*?)\s*\{'),
        re.compile(r'^(\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>)\s*\{'),
        re.compile(r'^(\s*(?:public|private|protected|static|async|override|abstract)\s+)*\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{'),
        re.compile(r'^(\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+)?\([^)]*\)\s*=>)\s*\{'),
    ]
    decorator_pattern = re.compile(r'^\s*@\w+')
    class_pattern = re.compile(r'^(\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+[^{]*?)\s*\{')

    i = 0
    while i < len(lines):
        line = lines[i]

        # Always include imports, type defs, decorators
        if import_pattern.match(line) or decorator_pattern.match(line):
            output_lines.append(line)
            i += 1
            continue

        # Class signature
        class_match = class_pattern.match(line)
        if class_match:
            output_lines.append(class_match.group(1) + " {")
            i += 1
            continue

        # Function signature
        matched = False
        for pattern in fn_patterns:
            m = pattern.match(line)
            if m:
                output_lines.append(m.group(0).rstrip(" {") + " { ... }")
                # Skip ahead past the function body (find matching closing brace)
                brace_depth = line.count("{") - line.count("}")
                if brace_depth > 0:
                    i += 1
                    while i < len(lines) and brace_depth > 0:
                        brace_depth += lines[i].count("{") - lines[i].count("}")
                        i += 1
                else:
                    i += 1
                matched = True
                break

        if not matched:
            # Include non-function lines (type annotations, const assignments, comments)
            stripped = line.strip()
            if stripped and not stripped.startswith("//") or stripped.startswith("// "):
                output_lines.append(line)
            i += 1

    return "\n".join(output_lines[:150])  # Cap at 150 lines


def extract_flagged_lines(path: str, content: str) -> str:
    """
    Returns function signatures PLUS lines matching anti-pattern keywords.
    Used for tech_debt report's targeted file extraction.
    """
    signatures = extract_signatures(path, content)

    # Anti-pattern patterns
    FLAG_PATTERNS = re.compile(
        r'(?:TODO|FIXME|HACK|XXX|WARN|DEPRECATED|BUG|WORKAROUND)',
        re.IGNORECASE
    )

    lines = content.splitlines()
    flagged_blocks: list[str] = []
    MAX_FLAGGED_CHARS = 1500  # hard cap on total flagged-line content added
    total_chars = 0

    for i, line in enumerate(lines):
        if FLAG_PATTERNS.search(line):
            # Include ±2 lines context
            start = max(0, i - 2)
            end = min(len(lines), i + 3)
            block = lines[start:end]
            block_text = "\n".join(block)

            if total_chars + len(block_text) > MAX_FLAGGED_CHARS:
                flagged_blocks.append("# (additional flagged lines truncated — budget reached)")
                break

            flagged_blocks.append(f"# Line {i+1}:")
            flagged_blocks.extend(block)
            flagged_blocks.append("")
            total_chars += len(block_text)

    if flagged_blocks:
        return signatures + "\n\n# === FLAGGED LINES ===\n" + "\n".join(flagged_blocks)
    return signatures


def extract_env_lines(path: str, content: str) -> str:
    """
    Returns only lines that reference env vars or look like hardcoded secrets.
    Used for security report's targeted file extraction.
    """
    lines = content.splitlines()
    env_pattern = re.compile(
        r'(?:process\.env\.|os\.environ|os\.getenv|import\.meta\.env\.|'
        r'secrets\.|password|token|secret|api_key|apikey)',
        re.IGNORECASE
    )
    # Potential hardcoded secrets: long alphanumeric strings near auth keywords
    secret_pattern = re.compile(
        r'(?:key|secret|password|token|auth)\s*[=:]\s*["\'][A-Za-z0-9+/=_\-]{16,}["\']',
        re.IGNORECASE
    )

    result_blocks: list[str] = []

    for i, line in enumerate(lines):
        if env_pattern.search(line) or secret_pattern.search(line):
            start = max(0, i - 2)
            end = min(len(lines), i + 3)
            block = lines[start:end]
            result_blocks.append(f"# Line {i+1} ({path}):")
            result_blocks.extend(block)
            result_blocks.append("")

    if result_blocks:
        return "\n".join(result_blocks[:80])
    return f"# No env var or secret usage detected in {path}"
