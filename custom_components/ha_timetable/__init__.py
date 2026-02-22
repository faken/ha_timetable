"""The Timetable integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, Event, HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv, entity_registry as er

from .const import CONF_NAME, DOMAIN
from .coordinator import TimetableCoordinator
from .frontend import async_register_frontend
from .store import TimetableStore

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

SET_TIME_SLOTS_SCHEMA = vol.Schema({
    vol.Required("entity_id"): cv.entity_id,
    vol.Required("time_slots"): list,
})

SET_LESSON_SCHEMA = vol.Schema({
    vol.Required("entity_id"): cv.entity_id,
    vol.Required("day"): vol.In(
        ["monday", "tuesday", "wednesday", "thursday", "friday"]
    ),
    vol.Required("slot"): vol.Coerce(int),
    vol.Required("subject"): cv.string,
    vol.Optional("teacher"): vol.Any(cv.string, None),
    vol.Optional("room"): vol.Any(cv.string, None),
    vol.Optional("color"): vol.Any(cv.string, None),
})

REMOVE_LESSON_SCHEMA = vol.Schema({
    vol.Required("entity_id"): cv.entity_id,
    vol.Required("day"): vol.In(
        ["monday", "tuesday", "wednesday", "thursday", "friday"]
    ),
    vol.Required("slot"): vol.Coerce(int),
})

CLEAR_TIMETABLE_SCHEMA = vol.Schema({
    vol.Required("entity_id"): cv.entity_id,
})


def _find_entry_data(
    hass: HomeAssistant, entity_id: str
) -> dict | None:
    """Find the runtime data (store + coordinator) for an entity."""
    registry = er.async_get(hass)
    entry = registry.async_get(entity_id)
    if entry and entry.config_entry_id:
        runtime = hass.data.get(DOMAIN, {}).get(entry.config_entry_id)
        if runtime:
            return runtime

    # Fallback for single-entry setups
    for entry_data in hass.data.get(DOMAIN, {}).values():
        if isinstance(entry_data, dict) and "store" in entry_data:
            return entry_data
    return None


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Timetable component."""
    hass.data.setdefault(DOMAIN, {})

    async def _setup_frontend(_event: Event | None = None) -> None:
        await async_register_frontend(hass)

    if hass.state == CoreState.running:
        await _setup_frontend()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _setup_frontend)

    # Register services
    async def handle_set_time_slots(call: ServiceCall) -> None:
        runtime = _find_entry_data(hass, call.data["entity_id"])
        if runtime:
            await runtime["store"].async_set_time_slots(call.data["time_slots"])
            await runtime["coordinator"].async_request_refresh()

    async def handle_set_lesson(call: ServiceCall) -> None:
        runtime = _find_entry_data(hass, call.data["entity_id"])
        if runtime:
            await runtime["store"].async_set_lesson(
                day=call.data["day"],
                slot=call.data["slot"],
                subject=call.data["subject"],
                teacher=call.data.get("teacher"),
                room=call.data.get("room"),
                color=call.data.get("color"),
            )
            await runtime["coordinator"].async_request_refresh()

    async def handle_remove_lesson(call: ServiceCall) -> None:
        runtime = _find_entry_data(hass, call.data["entity_id"])
        if runtime:
            await runtime["store"].async_remove_lesson(
                day=call.data["day"],
                slot=call.data["slot"],
            )
            await runtime["coordinator"].async_request_refresh()

    async def handle_clear_timetable(call: ServiceCall) -> None:
        runtime = _find_entry_data(hass, call.data["entity_id"])
        if runtime:
            await runtime["store"].async_clear()
            await runtime["coordinator"].async_request_refresh()

    hass.services.async_register(
        DOMAIN, "set_time_slots", handle_set_time_slots,
        schema=SET_TIME_SLOTS_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN, "set_lesson", handle_set_lesson,
        schema=SET_LESSON_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN, "remove_lesson", handle_remove_lesson,
        schema=REMOVE_LESSON_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN, "clear_timetable", handle_clear_timetable,
        schema=CLEAR_TIMETABLE_SCHEMA,
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Timetable from a config entry."""
    store = TimetableStore(hass, entry.entry_id)
    await store.async_load()

    coordinator = TimetableCoordinator(hass, entry, store)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = {
        "store": store,
        "coordinator": coordinator,
    }
    entry.runtime_data = hass.data[DOMAIN][entry.entry_id]

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(
        entry, PLATFORMS
    )
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Remove a config entry and its storage."""
    store = TimetableStore(hass, entry.entry_id)
    await store.async_remove()
