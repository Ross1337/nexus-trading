from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.models.symbol_rule import SymbolRule


async def normalize_symbol(raw: str, db: AsyncSession) -> str:
    if not raw:
        return raw
    clean = raw.strip().upper().replace("\x00", "")
    # Try exact match first
    result = await db.execute(
        select(SymbolRule).where(SymbolRule.input_pattern == clean, SymbolRule.enabled == True)
    )
    rule = result.scalar_one_or_none()
    if rule:
        return rule.output_symbol
    # Try prefix match (e.g. "OANDA:EURUSD")
    if ":" in clean:
        clean = clean.split(":", 1)[1]
    # Remove common suffixes
    for suffix in (".PRO", ".m", ".ECN", ".STP", ".RAW"):
        if clean.endswith(suffix.upper()):
            clean = clean[: -len(suffix)]
            break
    return clean
