"""Compile/test unchanged database logic without GTK/Tauri IPC on a Linux cloud machine.

This is supplementary validation. Windows CI must still run the full native suite.
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
import tomllib

parser = argparse.ArgumentParser()
parser.add_argument('--cargo', default='cargo')
parser.add_argument('--target-dir')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
packages = tomllib.loads((root / 'src-tauri/Cargo.lock').read_text())['package']

def pinned(name):
    matches = [package['version'] for package in packages if package['name'] == name]
    if len(matches) != 1:
        raise RuntimeError(f'Cannot resolve one locked version for {name}')
    return matches[0]

with tempfile.TemporaryDirectory(prefix='teacher-native-db-') as directory:
    work = Path(directory)
    manifest = '[package]\nname="teacher-workspace-native-check"\nversion="0.1.0"\nedition="2021"\n[lib]\npath="database.rs"\n[dependencies]\n'
    manifest += f'rusqlite={{version="={pinned("rusqlite")}",features=["bundled"]}}\n'
    manifest += f'serde={{version="={pinned("serde")}",features=["derive"]}}\nserde_json="={pinned("serde_json")}"\n'
    (work / 'Cargo.toml').write_text(manifest)
    shutil.copy2(root / 'src-tauri/Cargo.lock', work / 'Cargo.lock')
    source = (root / 'src-tauri/src/database.rs').read_text()
    source = source.replace('#[tauri::command]', '#[cfg(any())]')
    source = source.replace('../../src/database/migrations', (root / 'src/database/migrations').as_posix())
    (work / 'database.rs').write_text(source)
    target = args.target_dir or str(root / 'src-tauri/target/native-db-check')
    result = subprocess.run([args.cargo, 'test', '--lib', '--manifest-path', str(work / 'Cargo.toml'), '--target-dir', target, '-j', '2'])
    raise SystemExit(result.returncode)
