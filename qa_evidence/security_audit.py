import re
import os
import glob
import json

def audit_security():
    print("--- Phase 8: Static Security & Secret Audit ---")
    findings = []

    # 1. Regex patterns for secrets
    patterns = {
        "Groq API Key": r"gsk_[a-zA-Z0-9]{20,}",
        "Hindsight API Key": r"hs_[a-zA-Z0-9_\-]{16,}",
        "Generic Secret": r"(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]",
        "AWS Access Key": r"AKIA[0-9A-Z]{16}",
        "Private Key Header": r"-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----",
    }

    # Scan built frontend files
    dist_files = glob.glob("frontend/dist/**/*.js", recursive=True) + glob.glob("frontend/dist/**/*.html", recursive=True)
    frontend_src_files = glob.glob("frontend/src/**/*.js", recursive=True) + glob.glob("frontend/src/**/*.jsx", recursive=True)

    print(f"Scanning {len(dist_files)} built dist files and {len(frontend_src_files)} frontend source files...")

    all_files = dist_files + frontend_src_files
    for fpath in all_files:
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                for label, pattern in patterns.items():
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        findings.append({
                            "type": "Leaked Secret",
                            "severity": "CRITICAL",
                            "file": fpath,
                            "rule": label,
                            "match_count": len(matches)
                        })
        except Exception as e:
            print(f"Could not read {fpath}: {e}")

    # Check git tracked files for .env
    print("Checking git tracked files for accidental .env commits...")
    import subprocess
    git_files = subprocess.check_output(["git", "ls-files"], text=True).splitlines()
    for gf in git_files:
        if gf == ".env" or gf.endswith("/.env"):
            findings.append({
                "type": "Committed .env File",
                "severity": "CRITICAL",
                "file": gf,
                "rule": "Do not commit production secrets"
            })

    # Check for dangerouslySetInnerHTML in frontend
    print("Checking for unsafe HTML injections (XSS)...")
    for fpath in frontend_src_files:
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            if "dangerouslySetInnerHTML" in content:
                findings.append({
                    "type": "Potential XSS",
                    "severity": "MEDIUM",
                    "file": fpath,
                    "rule": "dangerouslySetInnerHTML usage"
                })

    print(f"\nSecurity Audit Complete. Findings count: {len(findings)}")
    if not findings:
        print("[ALL CLEAR] Zero secrets leaked in frontend bundles, zero committed .env files, zero unsafe HTML injections detected!")

    with open("qa_evidence/reports/security_audit_report.json", "w", encoding="utf-8") as f:
        json.dump({"findings": findings, "status": "SECURE" if not findings else "NEEDS_ATTENTION"}, f, indent=2)

if __name__ == "__main__":
    audit_security()
