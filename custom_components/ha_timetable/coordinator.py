"""DataUpdateCoordinator for Timetable integration."""
from __future__ import annotations

import copy
from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DAYS, DOMAIN
from .store import TimetableStore

_LOGGER = logging.getLogger(__name__)

DAY_MAP = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


class TimetableCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage timetable data and compute current/next lesson."""

    config_entry: ConfigEntry

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, store: TimetableStore
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_{entry.entry_id}",
            update_interval=timedelta(seconds=30),
        )
        self.store = store

    async def _async_update_data(self) -> dict[str, Any]:
        """Compute current and next lesson based on time."""
        data = self.store.get_data()
        time_slots = copy.deepcopy(data.get("time_slots", []))
        lessons = copy.deepcopy(data.get("lessons", {}))

        now = datetime.now()
        today = DAY_MAP.get(now.weekday())
        current_time = now.strftime("%H:%M")

        current_lesson = None
        next_lesson = None

        if today in DAYS:
            today_lessons = {l["slot"]: l for l in lessons.get(today, [])}
            slot_map = {s["slot"]: s for s in time_slots}

            for slot_def in sorted(time_slots, key=lambda s: s["start"]):
                slot_num = slot_def["slot"]
                lesson = today_lessons.get(slot_num)
                if not lesson:
                    continue

                if slot_def["start"] <= current_time <= slot_def["end"]:
                    current_lesson = {
                        **lesson,
                        "start_time": slot_def["start"],
                        "end_time": slot_def["end"],
                    }
                elif current_time < slot_def["start"] and next_lesson is None:
                    next_lesson = {
                        **lesson,
                        "start_time": slot_def["start"],
                        "end_time": slot_def["end"],
                        "day": today,
                    }

        # If no next lesson today, find next one in coming days
        if next_lesson is None:
            next_lesson = self._find_next_lesson_upcoming(
                now, time_slots, lessons
            )

        return {
            "time_slots": time_slots,
            "lessons": lessons,
            "current_lesson": current_lesson,
            "next_lesson": next_lesson,
        }

    def _find_next_lesson_upcoming(
        self,
        now: datetime,
        time_slots: list[dict],
        lessons: dict[str, list],
    ) -> dict[str, Any] | None:
        """Find the next lesson in upcoming days."""
        slot_map = {s["slot"]: s for s in time_slots}

        for offset in range(1, 8):
            future = now + timedelta(days=offset)
            day = DAY_MAP.get(future.weekday())
            if day not in DAYS:
                continue
            day_lessons = lessons.get(day, [])
            if not day_lessons:
                continue
            first = sorted(day_lessons, key=lambda l: l["slot"])[0]
            slot_def = slot_map.get(first["slot"])
            if slot_def:
                return {
                    **first,
                    "start_time": slot_def["start"],
                    "end_time": slot_def["end"],
                    "day": day,
                }
        return None
