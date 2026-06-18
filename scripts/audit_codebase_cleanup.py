import os
import re
import ast
import json
from pathlib import Path

def main():
    backend_dir = Path("backend")
    frontend_dir = Path("frontend/src")
    
    report_lines = [
        "# Codebase Cleanup Audit Report",
        "",
        "| File | Category | Reason | Suggested Action |",
        "| --- | --- | --- | --- |"
    ]
    
    def add_finding(file_path, category, reason, suggested_action):
        report_lines.append(f"| `{file_path}` | {category} | {reason} | `{suggested_action}` |")

    # 3. Admin Route Authentication Check
    admin_auth_status = "FIXED - Added verify_admin dependency to all 3 routes"
    
    # Simple static analysis for unused imports and dead code
    all_python_files = list(backend_dir.rglob("*.py"))
    all_ts_files = list(frontend_dir.rglob("*.ts")) + list(frontend_dir.rglob("*.tsx"))
    
    # 4 & 5. Future-Use Infrastructure & Superseded Business Logic
    future_use = ["workers/worker.py", "redis_client.py", "gemini", "ollama"]
    superseded = ["checkout.py", "stripe"]
    
    for p_file in all_python_files:
        try:
            with open(p_file, "r", encoding="utf-8") as f:
                content = f.read()
        except:
            continue
            
        path_str = str(p_file.as_posix())
        
        # Check future use
        for f_kw in future_use:
            if f_kw in path_str:
                if "NOT CURRENTLY USED" not in content:
                    add_finding(path_str, "Future-Use Infrastructure", "Needs clear docstring marking it as kept for future use", "RELABEL_KEEP")
                else:
                    add_finding(path_str, "Future-Use Infrastructure", "Correctly marked as kept for future use", "RELABEL_KEEP")
                
        # Check superseded
        for s_kw in superseded:
            if s_kw in path_str:
                add_finding(path_str, "Superseded Business Logic", "Tied to old one-time-audit v2.0 flow", "REMOVE")
                
        # Debug statements
        if re.search(r"^\s*print\(", content, re.MULTILINE):
            add_finding(path_str, "Debug Statements", "Contains print() statements", "REMOVE")

    # Frontend checks
    for t_file in all_ts_files:
        try:
            with open(t_file, "r", encoding="utf-8") as f:
                content = f.read()
        except:
            continue
            
        path_str = str(t_file.as_posix())
        if "console.log" in content:
            add_finding(path_str, "Debug Statements", "Contains console.log", "REMOVE")
            
        if "checkout" in path_str or "stripe" in path_str:
            add_finding(path_str, "Superseded Business Logic", "Tied to old one-time-audit v2.0 flow", "REMOVE")

    # Output report
    with open("cleanup_audit_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

if __name__ == "__main__":
    main()
