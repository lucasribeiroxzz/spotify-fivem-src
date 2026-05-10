DJConfig = {
    showBlips = true,
    interactionDistance = 5.0,
    allowMultipleDJs = false,
    blipPrefix = 'Mesa de DJ - ',
}

DJStations = {
    {
        name = 'Vanilla Unicorn',
        displayName = 'Vanilla Unicorn',
        coords = vector3(120.5, -1281.0, 29.5),
        range = 60.0,
        maxVolume = 90,
        allowedGroups = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 27,
            scale = 0.4,
        },
    },
    {
        name = 'Bahama Mamas',
        displayName = 'Bahama Mamas',
        coords = vector3(-1380.05, -626.98, 29.93),
        range = 60.0,
        maxVolume = 85,
        allowedGroups = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 3,
            scale = 0.4,
        },
    },
    {
        name = 'Turquia',
        displayName = 'Turquia',
        coords = vector3(1391.15, -737.22, 67.18),
        range = 10000.0,
        maxVolume = 10000,
        allowedGroups = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 3,
            scale = 0.4,
        },
    },
    {
        name = 'Tequi-la-la',
        displayName = 'Tequi-la-la',
        coords = vector3(-565.0, 276.5, 83.1),
        range = 70.0,
        maxVolume = 80,
        allowedGroups = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 5,
            scale = 0.4,
        },
    },
    {
        name = 'Galaxy Nightclub',
        displayName = 'Galaxy Nightclub',
        coords = vector3(345.0, 283.5, 105.5),
        range = 100.0,
        maxVolume = 95,
        allowedGroups = { 'Admin' },
        requireItem = true,
        item = 'dj_equipment',
        blip = {
            display = true,
            sprite = 136,
            color = 8,
            scale = 0.4,
        },
    },
    {
        name = 'Diamond Casino',
        displayName = 'Diamond Casino',
        coords = vector3(1089.5, 206.0, -49.0),
        range = 75.0,
        maxVolume = 85,
        allowedGroups = { 'Admin' },
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 4,
            scale = 0.4,
        },
    },
}

function GetDJStation(index)
    return DJStations[index]
end

function GetDJStationLabel(station)
    if not station then return '' end
    return station.displayName or station.name or ''
end

function GetNearestDJStation(coords, maxDistance)
    local nearestStation = nil
    local nearestDistance = maxDistance or math.huge
    local nearestIndex = nil

    for i, station in ipairs(DJStations) do
        local distance = #(coords - station.coords)
        if distance < nearestDistance then
            nearestDistance = distance
            nearestStation = station
            nearestIndex = i
        end
    end

    return nearestStation, nearestIndex, nearestDistance
end
