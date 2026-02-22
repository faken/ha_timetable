"""Persistent storage for timetable data."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DAYS, DEFAULT_TIME_SLOTS, DOMAIN, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class TimetableStore:
    """Handle persistent storage of timetable data."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the store."""
        self._store = Store[dict[str, Any]](
            hass,
            version=STORAGE_VERSION,
            key=f"{DOMAIN}.{entry_id}",
        )
        self._data: dict[str, Any] = {}

    async def async_load(self) -> dict[str, Any]:
        """Load data from storage."""
        stored = await self._store.async_load()
        if stored is not None:
            self._data = stored
        else:
            self._data = {
                "time_slots": list(DEFAULT_TIME_SLOTS),
                "lessons": {day: [] for day in DAYS},
            }
            await self.async_save()
        return self._data

    async def async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)

    async def async_remove(self) -> None:
        """Remove storage file."""
        await self._store.async_remove()

    def get_data(self) -> dict[str, Any]:
        """Get all timetable data."""
        return self._data

    def get_time_slots(self) -> list[dict[str, Any]]:
        """Get time slot definitions."""
        return self._data.get("time_slots", [])

    def get_lessons(self, day: str | None = None) -> dict | list:
        """Get lessons for all days or a specific day."""
        lessons = self._data.get("lessons", {})
        if day:
            return lessons.get(day, [])
        return lessons

    async def async_set_time_slots(
        self, time_slots: list[dict[str, Any]]
    ) -> None:
        """Set time slot definitions."""
        self._data["time_slots"] = time_slots
        await self.async_save()

    async def async_set_lesson(
        self,
        day: str,
        slot: int,
        subject: str,
        teacher: str | None = None,
        room: str | None = None,
        color: str | None = None,
    ) -> None:
        """Set or update a lesson."""
        if day not in DAYS:
            raise ValueError(f"Invalid day: {day}")

        lessons = self._data.setdefault("lessons", {})
        day_lessons: list = lessons.setdefault(day, [])

        # Update existing or add new
        for lesson in day_lessons:
            if lesson["slot"] == slot:
                lesson["subject"] = subject
                lesson["teacher"] = teacher
                lesson["room"] = room
                lesson["color"] = color
                await self.async_save()
                return

        day_lessons.append({
            "slot": slot,
            "subject": subject,
            "teacher": teacher,
            "room": room,
            "color": color,
        })
        day_lessons.sort(key=lambda x: x["slot"])
        await self.async_save()

    async def async_remove_lesson(self, day: str, slot: int) -> None:
        """Remove a lesson."""
        lessons = self._data.get("lessons", {})
        day_lessons = lessons.get(day, [])
        lessons[day] = [l for l in day_lessons if l["slot"] != slot]
        await self.async_save()

    async def async_clear(self) -> None:
        """Clear all lessons."""
        self._data["lessons"] = {day: [] for day in DAYS}
        await self.async_save()
