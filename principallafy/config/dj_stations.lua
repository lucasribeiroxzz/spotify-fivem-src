DJConfig = {
    showBlips = true,
    interactionDistance = 5.0,
    allowMultipleDJs = false,
}

DJStations = {
    {
        name = "Vanilla Unicorn",
        coords = vector3(120.5, -1281.0, 29.5),
        range = 60.0,
        maxVolume = 90,
        permission = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 27,
            scale = 0.4
        }
    },
    {
        name = "Bahama Mamas",
        coords = vector3(-1380.05,-626.98,29.93),
        range = 60.0,
        maxVolume = 85,
        permission = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 3,
            scale = 0.4
        }
    },
    {
        name = "Turquia",
        coords = vector3(1391.15,-737.22,67.18),
        range = 10000.0,
        maxVolume = 10000,
        permission = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 3,
            scale = 0.4
        }
    },
    {
        name = "Tequi-la-la",
        coords = vector3(-565.0, 276.5, 83.1),
        range = 70.0,
        maxVolume = 80,
        permission = nil,
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 5,
            scale = 0.4
        }
    },
    {
        name = "Galaxy Nightclub",
        coords = vector3(345.0, 283.5, 105.5),
        range = 100.0,
        maxVolume = 95,
        permission = "dj.galaxy",
        requireItem = true,
        item = "dj_equipment",
        blip = {
            display = true,
            sprite = 136,
            color = 8,
            scale = 0.4
        }
    },
    {
        name = "Diamond Casino",
        coords = vector3(1089.5, 206.0, -49.0),
        range = 75.0,
        maxVolume = 85,
        permission = "dj.casino",
        requireItem = false,
        item = nil,
        blip = {
            display = true,
            sprite = 136,
            color = 4,
            scale = 0.4
        }
    }
}

function GetDJStation(index)
    if DJStations[index] then
        return DJStations[index]
    end
    return nil
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