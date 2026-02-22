"""Constants for the Timetable integration."""
from __future__ import annotations

from typing import Final

VERSION: Final = "1.0.8"
DOMAIN: Final = "ha_timetable"
STORAGE_VERSION: Final = 1
URL_BASE: Final = "/ha-timetable"
CARD_NAME: Final = "ha-timetable-card"
CARD_FILE: Final = "ha-timetable-card.js"

CONF_NAME: Final = "name"

DAYS: Final = ["monday", "tuesday", "wednesday", "thursday", "friday"]

DEFAULT_TIME_SLOTS: Final = [
    {"slot": 1, "start": "08:00", "end": "08:45"},
    {"slot": 2, "start": "08:50", "end": "09:35"},
    {"slot": 3, "start": "09:50", "end": "10:35"},
    {"slot": 4, "start": "10:40", "end": "11:25"},
    {"slot": 5, "start": "11:40", "end": "12:25"},
    {"slot": 6, "start": "12:30", "end": "13:15"},
]
