import re

from fastapi import HTTPException, status


def normalize_lk_phone(raw: str) -> str:
    """Turn local Sri Lankan numbers into E.164 (+94…)."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("94") and len(digits) == 11:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+94{digits[1:]}"
    if len(digits) == 9 and digits.startswith("7"):
        return f"+94{digits}"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Enter a Sri Lankan mobile number, e.g. 0771234567",
    )


def looks_like_phone(raw: str) -> bool:
    digits = re.sub(r"\D", "", raw or "")
    return digits.startswith("0") or digits.startswith("94") or (len(digits) == 9 and digits.startswith("7"))
