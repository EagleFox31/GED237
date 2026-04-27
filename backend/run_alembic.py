import subprocess
import sys

try:
    out = subprocess.check_output(
        [
            sys.executable,
            "-m",
            "alembic",
            "revision",
            "--autogenerate",
            "-m",
            "Add Notification model",
        ],
        stderr=subprocess.STDOUT,
    )
    text = out.decode("utf-8", "replace")
except subprocess.CalledProcessError as e:
    text = e.output.decode("utf-8", "replace")

with open("alembic_output2.txt", "w", encoding="utf-8") as f:
    f.write(text)
