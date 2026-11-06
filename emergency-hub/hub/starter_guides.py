"""Starter guides added on first run.

These are templates written for this app, NOT authoritative sources. Each one says so and names the
public agency to check against. Edit them to match the references you import, or delete them.
"""

NOTE = ("*Starter template written for this app - not an authoritative source. Check it against the official "
        "guidance you import (see STARTER_RESOURCES.md) and edit it to fit your household.*")

STARTER_GUIDES = [
    {
        "title": "Emergency numbers and contacts",
        "category": "Family Preparedness",
        "kind": "guide",
        "body": NOTE + """

Fill this in now, while things are calm. Print a copy too.

- **Emergency services:** 911 (US/Canada), 112 (EU), 999 (UK) - replace with yours
- **Poison control:** US Poison Help 1-800-222-1222 - replace with yours
- **Out-of-area contact** (everyone checks in with this person):
- **Doctor / clinic:**
- **Nearest hospital** and route:
- **Utility companies** (power, gas, water):
- **Neighbours who can help:**
- **School / work emergency lines:**
""",
    },
    {
        "title": "Family emergency plan",
        "category": "Family Preparedness",
        "kind": "checklist",
        "body": NOTE + "\n\nBased on the kind of planning steps FEMA's Ready.gov recommends. Work through it together.",
        "items": [
            "Pick a meeting place right outside the home",
            "Pick a meeting place outside the neighbourhood",
            "Choose one out-of-area contact everyone will call or text",
            "Write contact numbers on paper for every family member (phones die)",
            "Know two ways out of every room",
            "Plan for pets, babies, older relatives and anyone with medical needs",
            "Know how to shut off water, power and gas (see Home Repairs)",
            "Keep copies of IDs, insurance and medical info in a waterproof bag",
            "Practise the plan once a year",
        ],
    },
    {
        "title": "Emergency kit (at least 3 days)",
        "category": "Family Preparedness",
        "kind": "checklist",
        "body": NOTE + "\n\nA common recommendation (FEMA / Ready.gov) is at least 1 gallon (about 4 litres) of water "
                       "per person per day, for several days. Verify the current figure on ready.gov.",
        "items": [
            "Water: 1 gallon / ~4 L per person per day, at least 3 days",
            "Non-perishable food for at least 3 days, and a manual can opener",
            "Battery or hand-crank radio",
            "Flashlights and spare batteries",
            "First aid kit",
            "Prescription medicines and glasses",
            "Whistle to signal for help",
            "Dust masks, plastic sheeting and duct tape",
            "Wet wipes, rubbish bags and ties for sanitation",
            "Wrench or pliers to turn off utilities",
            "Phone chargers and a power bank",
            "Cash, copies of important documents",
            "Baby, pet and medical supplies if needed",
            "Check and refresh the kit every 6 months",
        ],
    },
    {
        "title": "First aid kit contents",
        "category": "First Aid",
        "kind": "checklist",
        "body": NOTE + "\n\nThis is a supplies list only. It is not treatment advice. Take a first aid course and keep "
                       "a printed first aid manual from a recognised body (e.g. Red Cross, St John) with the kit.",
        "items": [
            "Printed first aid manual",
            "Adhesive bandages, several sizes",
            "Sterile gauze pads and rolls",
            "Adhesive tape",
            "Elastic (crepe) bandage",
            "Triangular bandage",
            "Disposable gloves",
            "Scissors and tweezers",
            "Antiseptic wipes",
            "Instant cold pack",
            "Thermometer",
            "Emergency (foil) blanket",
            "Personal prescription medicines (check expiry dates)",
        ],
    },
    {
        "title": "Water: what to do when it may be unsafe",
        "category": "Water and Sanitation",
        "kind": "guide",
        "body": NOTE + """

- If authorities issue a boil-water notice, follow it exactly.
- Use stored or bottled water first.
- **Boiling** is a widely recommended method: CDC guidance is to bring water to a rolling boil for 1 minute
  (3 minutes above 6,500 ft / 2,000 m). Verify on the CDC's "Making Water Safe in an Emergency" page.
- **Chemical disinfection (e.g. unscented household bleach):** use only the amounts printed in an
  authoritative guide. Import one into your library - this app deliberately doesn't give amounts.
- Water contaminated with fuel or toxic chemicals can't be made safe by boiling or bleach. Find another source.
- Cloudy water: let it settle and filter it through clean cloth before disinfecting.
""",
    },
    {
        "title": "Food safety during a power cut",
        "category": "Food and Preservation",
        "kind": "guide",
        "body": NOTE + """

Commonly cited USDA guidance (verify on the USDA FSIS "Keeping Food Safe During an Emergency" page):

- Keep fridge and freezer doors closed as much as possible.
- An unopened fridge keeps food cold for about 4 hours.
- A full freezer holds its temperature for about 48 hours (about 24 hours if half full).
- Keep an appliance thermometer in the fridge and freezer.
- Perishable food (meat, dairy, leftovers) kept above 40 °F / 4 °C for over 2 hours should be thrown out.
- **When in doubt, throw it out.** Never taste food to check if it's safe.
""",
    },
    {
        "title": "Power outage checklist",
        "category": "Power Outages",
        "kind": "checklist",
        "body": NOTE + "\n\nCarbon monoxide from generators, grills and camp stoves used indoors kills people every "
                       "year in outages.",
        "items": [
            "Use flashlights, not candles, where you can",
            "Run generators OUTDOORS only, far from windows, doors and vents",
            "Never use a grill, camp stove or generator inside, even in a garage",
            "Make sure a battery carbon monoxide alarm is working",
            "Unplug sensitive electronics to protect them from surges",
            "Keep fridge and freezer closed (see the food safety guide)",
            "Stay away from downed power lines and report them",
            "Check on neighbours, especially older people",
            "Keep phones charged from a power bank or car (car outside, running only in the open)",
        ],
    },
    {
        "title": "Know your shutoffs",
        "category": "Home Repairs",
        "kind": "checklist",
        "body": NOTE + "\n\nFind these before you need them. Label them, and show every adult in the home.",
        "items": [
            "Main water shutoff valve: location found and labelled",
            "Electrical panel / main breaker: location found and labelled",
            "Gas meter shutoff: location found (only shut it off if you smell gas or suspect a leak; "
            "a professional may need to turn it back on)",
            "Wrench for the gas shutoff kept near the meter",
            "Know where the water heater's own shutoff is",
            "Basic kit: duct tape, plastic sheeting, tarp, screwdrivers, pliers, work gloves",
        ],
    },
    {
        "title": "Foraging safety rules",
        "category": "Foraging",
        "kind": "guide",
        "body": NOTE + """

- **Never eat a wild plant, berry or mushroom unless an experienced local expert has identified it in person.**
- An app, a photo, a book picture or an AI answer is not enough - several deadly species closely resemble edible ones.
- This app will never tell you a wild plant or mushroom is safe to eat.
- Don't forage near roads, industrial sites or sprayed fields.
- If someone may have eaten something poisonous, contact poison control or emergency services right away,
  and keep a sample of what was eaten.
""",
    },
    {
        "title": "Seed and garden supplies",
        "category": "Gardening",
        "kind": "checklist",
        "body": NOTE + "\n\nFor what grows in your area and when to plant, import your local agricultural extension "
                       "service's guides.",
        "items": [
            "Seeds for crops that grow well locally (store cool and dry)",
            "Hand tools: spade, hoe, rake, trowel",
            "Rain barrel or water storage for the garden",
            "Compost bin",
            "Gloves and a pocket knife",
            "Local planting calendar printed or imported",
        ],
    },
]
