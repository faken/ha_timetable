"""Sensor platform for Timetable integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_NAME, DOMAIN
from .coordinator import TimetableCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up timetable sensors."""
    coordinator: TimetableCoordinator = entry.runtime_data["coordinator"]
    name = entry.data[CONF_NAME]

    async_add_entities([
        TimetableCurrentLessonSensor(coordinator, entry, name),
        TimetableNextLessonSensor(coordinator, entry, name),
    ])


class TimetableCurrentLessonSensor(
    CoordinatorEntity[TimetableCoordinator], SensorEntity
):
    """Sensor showing the current lesson."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:school"

    def __init__(
        self,
        coordinator: TimetableCoordinator,
        entry: ConfigEntry,
        name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_current_lesson"
        self._attr_translation_key = "current_lesson"
        self._timetable_name = name
        self._entry = entry

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device info."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._timetable_name,
            "manufacturer": "Timetable",
            "model": "School Timetable",
        }

    @property
    def native_value(self) -> str:
        """Return the current lesson subject."""
        data = self.coordinator.data or {}
        current = data.get("current_lesson")
        if current:
            return current.get("subject", "")
        return "Free"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra attributes including full timetable data."""
        data = self.coordinator.data or {}
        current = data.get("current_lesson")

        attrs: dict[str, Any] = {
            "timetable_name": self._timetable_name,
            "timetable_data": {
                "time_slots": data.get("time_slots", []),
                "lessons": data.get("lessons", {}),
            },
        }

        if current:
            attrs["teacher"] = current.get("teacher")
            attrs["room"] = current.get("room")
            attrs["color"] = current.get("color")
            attrs["slot"] = current.get("slot")
            attrs["start_time"] = current.get("start_time")
            attrs["end_time"] = current.get("end_time")

        return attrs


class TimetableNextLessonSensor(
    CoordinatorEntity[TimetableCoordinator], SensorEntity
):
    """Sensor showing the next lesson."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:school-outline"

    def __init__(
        self,
        coordinator: TimetableCoordinator,
        entry: ConfigEntry,
        name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_next_lesson"
        self._attr_translation_key = "next_lesson"
        self._timetable_name = name
        self._entry = entry

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device info."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._timetable_name,
            "manufacturer": "Timetable",
            "model": "School Timetable",
        }

    @property
    def native_value(self) -> str:
        """Return the next lesson subject."""
        data = self.coordinator.data or {}
        next_l = data.get("next_lesson")
        if next_l:
            return next_l.get("subject", "")
        return "Free"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra attributes."""
        data = self.coordinator.data or {}
        next_l = data.get("next_lesson")

        attrs: dict[str, Any] = {"timetable_name": self._timetable_name}

        if next_l:
            attrs["teacher"] = next_l.get("teacher")
            attrs["room"] = next_l.get("room")
            attrs["color"] = next_l.get("color")
            attrs["slot"] = next_l.get("slot")
            attrs["start_time"] = next_l.get("start_time")
            attrs["end_time"] = next_l.get("end_time")
            attrs["day"] = next_l.get("day")

        return attrs
