"""Run a scoped Unity Pipeline command from Mini-Imp. No credentials are stored."""
import json
import pathlib
import subprocess
import sys

project = str(pathlib.Path(__file__).resolve().parent.parent)
cli = str(pathlib.Path.home() / '.local/bin/unity')
args = sys.argv[1:]
if len(args) == 2 and args[0] == '--script':
    args = ['script', 'eval', '--', '--code', pathlib.Path(args[1]).read_text(), '--timeout', '120000']
result = subprocess.run([cli, 'command', '--project-path', project, '--caller', 'plugin', '--skill', 'unity-cli', '--format', 'json', '--timeout', '150', *args], capture_output=True, text=True, timeout=160)
if result.stdout:
    try:
        output = json.loads(result.stdout)
        print(json.dumps(output, indent=2))
        inner = (output.get('data') or {}).get('result')
        if isinstance(inner, dict) and inner.get('success') is False:
            sys.exit(1)
    except json.JSONDecodeError:
        print(result.stdout)
if result.returncode:
    print(result.stderr, file=sys.stderr)
sys.exit(result.returncode)
