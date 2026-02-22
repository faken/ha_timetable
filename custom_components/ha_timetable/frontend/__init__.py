"""Frontend registration for Timetable integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from ..const import CARD_FILE, URL_BASE, VERSION

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the frontend card resources."""
    # Register static path to serve the card JS
    try:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    URL_BASE,
                    str(FRONTEND_DIR),
                    False,
                )
            ]
        )
    except RuntimeError:
        _LOGGER.debug("Static path %s already registered", URL_BASE)

    # Register as Lovelace resource (storage mode only)
    lovelace = hass.data.get("lovelace")
    if lovelace and lovelace.mode == "storage":
        resources = lovelace.resources
        await resources.async_load()

        url = f"{URL_BASE}/{CARD_FILE}?v={VERSION}"

        # Check for existing registration
        existing = [
            r for r in resources.async_items()
            if CARD_FILE in r.get("url", "")
        ]

        if existing:
            for item in existing:
                if item.get("url") != url:
                    await resources.async_update_item(
                        item["id"], {"res_type": "module", "url": url}
                    )
        else:
            await resources.async_create_item(
                {"res_type": "module", "url": url}
            )
        _LOGGER.info("Registered Lovelace resource: %s", url)
    else:
        _LOGGER.warning(
            "Lovelace is in YAML mode. Add this resource manually:\n"
            "  url: %s/%s\n  type: module",
            URL_BASE,
            CARD_FILE,
        )
