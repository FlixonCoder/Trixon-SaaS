import os
import re

# Paths
ROOT_DIR = r"c:\Users\Dell\OneDrive\Desktop\product"
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend", "src")
SQL_MIGRATION_FILE = os.path.join(ROOT_DIR, "supabase", "migrations", "002_v3_snapshot_intelligence.sql")
REPORT_MD_PATH = os.path.join(ROOT_DIR, "audit_report.md")

GATING_KEYWORDS = [
    "Full Audit", "Unlock", "is_locked", "is_pro", "plan ==", "plan !=", 
    "\"free\"", "'free'", "\"pro\"", "'pro'", "max_repos", "max_projects", 
    "analyses_per_month", "rate_limit", "quota", "403", "PaymentRequired", 
    "checkout", "stripe", "Stripe"
]

def scan_files(directory, extensions, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = ["node_modules", "venv", ".next", "__pycache__", ".git", ".pytest_cache"]
    
    matches = []
    for root, dirs, files in os.walk(directory):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines):
                        for keyword in GATING_KEYWORDS:
                            # Use word boundaries or simple substring depending on keyword
                            if keyword in line:
                                matches.append({
                                    "file": os.path.relpath(file_path, ROOT_DIR),
                                    "line_num": idx + 1,
                                    "snippet": line.strip(),
                                    "context": lines[max(0, idx-2):min(len(lines), idx+3)],
                                    "keyword": keyword
                                })
                                break # match once per line
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
    return matches

def main():
    print("Starting Audit...")
    
    # --- 1. Gating & Limit Mechanisms ---
    print("Scanning for gating and limit mechanisms...")
    backend_matches = scan_files(BACKEND_DIR, [".py"])
    frontend_matches = scan_files(FRONTEND_DIR, [".ts", ".tsx"])
    all_gating_matches = backend_matches + frontend_matches
    
    gating_rows = []
    for m in all_gating_matches:
        # Surrounding context formatted for markdown
        snippet = m["snippet"]
        if len(snippet) > 80:
            snippet = snippet[:80] + "..."
        snippet = snippet.replace("|", "\\|")
        
        # Surrounding context
        context_str = "<pre>" + "".join(m["context"]).replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>") + "</pre>"
        
        # Guess origin & action
        origin = "v1/v2"
        action = "GATE_BEHIND_BETA_MODE"
        path_lower = m["file"].lower()
        if "checkout" in path_lower or "stripe" in path_lower:
            origin = "v2"
            action = "KEEP" if "checkout.py" in path_lower else "REMOVE"
        elif "pricing" in path_lower or "pricing" in snippet.lower():
            origin = "v1/v2"
            action = "REMOVE" if "pricing" in path_lower else "GATE_BEHIND_BETA_MODE"
            
        gating_rows.append(f"| {m['file']} | {m['line_num']} | `{snippet}` | {origin} | {action} |")
        
    # --- 2. Chat Feature Presence ---
    print("Checking Chat Feature...")
    chat_page_path = os.path.join(FRONTEND_DIR, "app", "(app)", "projects", "[id]", "chat", "page.tsx")
    chat_comp_path = os.path.join(FRONTEND_DIR, "components", "project-chat.tsx")
    
    chat_page_exists = os.path.exists(chat_page_path)
    chat_comp_exists = os.path.exists(chat_comp_path)
    
    chat_references = []
    # Scan where chat page or /chat is linked or referenced
    for root, dirs, files in os.walk(FRONTEND_DIR):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".next"]]
        for file in files:
            if file.endswith((".ts", ".tsx")):
                fpath = os.path.join(root, file)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    if "/chat" in content or "project-chat" in content or "ProjectChat" in content:
                        chat_references.append(os.path.relpath(fpath, ROOT_DIR))
                except Exception:
                    pass
                    
    # --- 3. Report Catalog Reconciliation ---
    print("Reading Report Catalog and Display page...")
    catalog_items = []
    if os.path.exists(SQL_MIGRATION_FILE):
        try:
            with open(SQL_MIGRATION_FILE, "r", encoding="utf-8") as f:
                sql_content = f.read()
            # Extract insert statements for report_catalog
            matches = re.findall(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(TRUE|FALSE),\s*(\d+)\)", sql_content)
            for m in matches:
                catalog_items.append({
                    "id": m[0],
                    "title": m[1],
                    "is_default": m[5]
                })
        except Exception as e:
            print(f"Error reading SQL: {e}")
            
    # Find reports pages
    reports_pages = []
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if "reports" in root.lower() and file.endswith((".ts", ".tsx")):
                reports_pages.append(os.path.relpath(os.path.join(root, file), ROOT_DIR))

    # --- 4. Orphaned/Dead Code Detection ---
    print("Detecting Orphaned / Dead Code...")
    orphaned_items = []
    
    # Check if checkout.py is registered in main.py
    main_py_path = os.path.join(BACKEND_DIR, "main.py")
    checkout_registered = False
    if os.path.exists(main_py_path):
        with open(main_py_path, "r", encoding="utf-8") as f:
            main_content = f.read()
        if "checkout_router" in main_content:
            checkout_registered = True
            
    if os.path.exists(os.path.join(BACKEND_DIR, "api", "checkout.py")):
        orphaned_items.append({
            "concept": "Stripe Checkout API",
            "file": "backend/api/checkout.py",
            "status": "Dormant (but registered in main.py)" if checkout_registered else "Unregistered / Dormant",
            "action": "KEEP"
        })
        
    pricing_page_path = os.path.join(FRONTEND_DIR, "app", "(app)", "pricing", "page.tsx")
    if os.path.exists(pricing_page_path):
        orphaned_items.append({
            "concept": "Pricing Page",
            "file": "frontend/src/app/(app)/pricing/page.tsx",
            "status": "Exists in frontend",
            "action": "GATE_BEHIND_BETA_MODE"
        })

    # Output to markdown file
    with open(REPORT_MD_PATH, "w", encoding="utf-8") as f:
        f.write("# Trixon v3.2 Completeness & Gating Audit Report\n\n")
        
        # Section 1
        f.write("## 1. Gating & Limit Mechanisms\n")
        f.write("| File | Line | Snippet | Likely Origin | Suggested Action |\n")
        f.write("| --- | --- | --- | --- | --- |\n")
        for row in gating_rows:
            f.write(row + "\n")
        f.write("\n")
        
        # Section 2
        f.write("## 2. Chat Feature Presence\n")
        f.write(f"- **`/projects/[id]/chat/page.tsx` Exists:** {'✅ Yes' if chat_page_exists else '❌ No'}\n")
        f.write(f"- **`project-chat.tsx` Component Exists:** {'✅ Yes' if chat_comp_exists else '❌ No'}\n\n")
        f.write("### References to Chat in codebase:\n")
        for ref in chat_references:
            f.write(f"- [{ref}](file:///{os.path.join(ROOT_DIR, ref).replace('\\\\', '/')})\n")
        f.write("\n")
        
        # Section 3
        f.write("## 3. Report Catalog vs. Report Display Reconciliation\n")
        f.write("### Report Catalog (from SQL Seed):\n")
        f.write("| ID | Title | Is Default |\n")
        f.write("| --- | --- | --- |\n")
        for item in catalog_items:
            f.write(f"| {item['id']} | {item['title']} | {item['is_default']} |\n")
        f.write("\n")
        f.write("### Identified Report Pages / Components:\n")
        for page in reports_pages:
            f.write(f"- [{page}](file:///{os.path.join(ROOT_DIR, page).replace('\\\\', '/')})\n")
        f.write("\n")
        
        # Section 4
        f.write("## 4. Orphaned / Dead Code Detection\n")
        f.write("| Legacy Concept | File Reference | Current Status | Suggested Action |\n")
        f.write("| --- | --- | --- | --- |\n")
        for item in orphaned_items:
            f.write(f"| {item['concept']} | {item['file']} | {item['status']} | {item['action']} |\n")
        f.write("\n")
        
        f.write("## 5. Audit Conclusions\n")
        f.write("This report has been compiled automatically. Adjustments will be made based on user review and the implementation of the global `BETA_MODE` flag.\n")

    print(f"Audit Complete! Report saved to {REPORT_MD_PATH}")

if __name__ == "__main__":
    main()
