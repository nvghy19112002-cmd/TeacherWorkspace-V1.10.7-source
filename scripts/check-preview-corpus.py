"""Compile corpus drawing fixtures. Run the corpus Vitest test first."""
import argparse
import concurrent.futures
import json
import pathlib
import subprocess
import sys

parser = argparse.ArgumentParser(description="Compile the 200-question corpus drawings with XeLaTeX.")
parser.add_argument("--output", default="test-results/tex-corpus")
args = parser.parse_args()
root = pathlib.Path(args.output).resolve()
root.mkdir(exist_ok=True, parents=True)
docs = json.loads(pathlib.Path("test-results/corpus-drawings.json").read_text(encoding="utf-8"))


def compile_drawing(item):
    index, doc = item
    directory = root / f"{index + 1:03}"
    directory.mkdir(exist_ok=True)
    (directory / "figure.pdf").unlink(missing_ok=True)
    (directory / "failure.txt").unlink(missing_ok=True)
    (directory / "figure.tex").write_text(doc["document"], encoding="utf-8")
    (directory / "question.tex").write_text(doc["question"], encoding="utf-8")
    try:
        result = subprocess.run(
            ["xelatex", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "figure.tex"],
            cwd=directory, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=45,
        )
        log = result.stdout + result.stderr
        error = next((line for line in log.splitlines() if line.startswith("!")), "")
        if result.returncode:
            (directory / "failure.txt").write_text(log[-7000:], encoding="utf-8")
        return {"figure": index + 1, "success": result.returncode == 0, "error": error}
    except subprocess.TimeoutExpired:
        return {"figure": index + 1, "success": False, "error": "timeout45s"}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(compile_drawing, enumerate(docs)))
(root / "report.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"total": len(results), "passed": sum(r["success"] for r in results),
                  "failures": [r for r in results if not r["success"]]}, ensure_ascii=False, indent=2))
sys.exit(0 if all(r["success"] for r in results) else 1)
