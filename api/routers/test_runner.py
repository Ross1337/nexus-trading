import subprocess
from fastapi import APIRouter, Depends
from api.auth import get_current_user

router = APIRouter(prefix="/api/test-runner", tags=["test_runner"])


@router.post("/run")
async def run_tests(_: dict = Depends(get_current_user)):
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", "tests/", "-v", "--tb=short", "--no-header"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-2000:],
        }
    except Exception as e:
        return {"error": str(e)}
