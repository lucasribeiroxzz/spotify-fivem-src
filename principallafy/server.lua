local Tunnel = module('vrp', 'lib/Tunnel')
local Proxy  = module('vrp', 'lib/Proxy')
vRPC = Tunnel.getInterface('vRP')
vRP  = Proxy.getInterface('vRP')

local SharedConfig = {}
local Config       = {}

local audioSources       = {}
local djSources          = {}
local playerMuteStatus   = {}
local playerPositions    = {}
local playerVolumeSettings = {}

local lastPositionUpdate    = {}
local lastAudioSync         = {}
local positionUpdateInterval = 500
local audioSyncInterval      = 1000

local Debug = false
local function log(msg)
    if Debug then print('[principallafy] ' .. tostring(msg)) end
end

local function loadFile(path)
    local raw = LoadResourceFile(GetCurrentResourceName(), path)
    if not raw then return nil end
    local fn, err = load(raw)
    if not fn then
        print('^1[principallafy] erro ao carregar ' .. path .. ': ' .. tostring(err) .. '^0')
        return nil
    end
    local ok, result = pcall(fn)
    if not ok then
        print('^1[principallafy] erro ao executar ' .. path .. ': ' .. tostring(result) .. '^0')
        return nil
    end
    return result
end

local djStationsRaw = LoadResourceFile(GetCurrentResourceName(), 'config/dj_stations.lua')
if djStationsRaw then
    load(djStationsRaw)()
else
    print('^1[principallafy] config/dj_stations.lua nao encontrado^0')
    DJStations = {}
    DJConfig   = {}
end

CreateThread(function()
    Config       = loadFile('config.lua')        or {}
    SharedConfig = loadFile('shared/config.lua') or {}
    log('configuracoes carregadas')
end)

local storage = {
    favorites = {},
    playlists = {},
    history   = {},
    videos    = {},
}

CreateThread(function()
    local raw = LoadResourceFile(GetCurrentResourceName(), 'storage.json')
    if not raw then return end
    local ok, decoded = pcall(json.decode, raw)
    if ok and decoded then storage = decoded end
end)

local function getPassport(source)
    if not source or source == 0 then return nil end
    if not vRP or not vRP.Passport then return nil end
    local ok, passport = pcall(vRP.Passport, source)
    if ok and passport then return tonumber(passport) end
    return nil
end

local function getIdentity(passport)
    if not passport or not vRP or not vRP.Identity then return nil end
    local ok, identity = pcall(vRP.Identity, passport)
    if ok then return identity end
    return nil
end

local function playerHasGroup(passport, group)
    if not passport or not group then return false end
    if not vRP or not vRP.HasGroup then return false end
    local ok, result = pcall(vRP.HasGroup, passport, group)
    if not ok then return false end
    if result == true then return true end
    if type(result) == 'number' and result >= 1 then return true end
    return false
end

local function hasInventoryItem(passport, item, qty)
    qty = qty or 1
    if not vRP then return false end

    if vRP.InventoryItemAmount then
        local ok, amount = pcall(vRP.InventoryItemAmount, passport, item)
        if ok and amount then return amount >= qty end
    end

    if vRP.HasItem then
        local ok, result = pcall(vRP.HasItem, passport, item, qty)
        if ok then
            if result == true then return true end
            if type(result) == 'number' and result >= qty then return true end
            return false
        end
    end

    if vRP.GetInventoryItemAmount then
        local ok, amount = pcall(vRP.GetInventoryItemAmount, passport, item)
        if ok and amount then return amount >= qty end
    end

    return false
end

local function notify(source, kind, message)
    local mapping = {
        sucesso  = { 'Sucesso', 'verde' },
        negado   = { 'Negado',  'vermelho' },
        aviso    = { 'Aviso',   'amarelo' },
        info     = { 'Aviso',   'amarelo' },
    }
    local cfg = mapping[kind] or { 'Aviso', 'amarelo' }
    TriggerClientEvent('Notify', source, cfg[1], message, cfg[2], 5000)
end

local function getPermissions()
    return (SharedConfig and SharedConfig.permissions) or {
        enabled = false,
        soundCommand = {},
        djCommand = {},
        deniedMessage = 'Sem permissao.',
    }
end

local getUserId       = getPassport
local getUserIdentity = getIdentity

local function hasAnyGroup(passport, groups)
    if not groups or #groups == 0 then return true end
    if not passport then return false end
    for _, g in ipairs(groups) do
        if playerHasGroup(passport, g) then
            return true
        end
    end
    return false
end

local function canUseSoundCommand(passport)
    local perms = getPermissions()
    if not perms.enabled then return true end
    return hasAnyGroup(passport, perms.soundCommand)
end

local function canUseDjCommand(passport)
    local perms = getPermissions()
    if not perms.enabled then return true end
    return hasAnyGroup(passport, perms.djCommand)
end

local function getPlayerDisplayName(source, passport)
    local name = GetPlayerName(source) or ('Player_' .. tostring(source))
    if passport then
        local identity = getIdentity(passport)
        if identity then
            local first = identity.nome or identity.firstname or identity.name or identity.firstName
            local last  = identity.sobrenome or identity.lastname or identity.lastName
            if first and last then
                name = first .. ' ' .. last
            elseif identity.fullName then
                name = identity.fullName
            end
        end
    end
    return name
end

local function openMusicMenu(source, user_id)
    local name = getPlayerDisplayName(source, user_id)
    print(('^2[principallafy] %s (id=%s, src=%s) abriu o menu de som^0')
        :format(name, tostring(user_id), tostring(source)))
    TriggerClientEvent('principal:openMusicMenu', source, name)
end

local function openDjMenu(source, user_id, stationIndex)
    local station = DJStations[stationIndex]
    if not station then
        notify(source, 'negado', 'Mesa de DJ invalida.')
        return
    end

    local ped    = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    local distance = #(coords - station.coords)
    local maxDist  = (DJConfig and DJConfig.interactionDistance) or 5.0

    if distance > maxDist then
        notify(source, 'negado', 'Voce esta muito longe da mesa de DJ.')
        return
    end

    if station.allowedGroups and #station.allowedGroups > 0 then
        if not hasAnyGroup(user_id, station.allowedGroups) then
            notify(source, 'negado', 'Voce nao tem permissao para esta mesa de DJ.')
            return
        end
    end

    if station.requireItem and station.item then
        if not hasInventoryItem(user_id, station.item, 1) then
            notify(source, 'negado', 'Voce precisa do item: ' .. station.item)
            return
        end
    end

    if not (DJConfig and DJConfig.allowMultipleDJs) and djSources[stationIndex] then
        notify(source, 'negado', 'Esta mesa de DJ ja esta sendo usada.')
        return
    end

    local label = (station.displayName or station.name or 'Mesa')
    local name  = getPlayerDisplayName(source, user_id)

    TriggerClientEvent('principal:openDJMenu', source, {
        playerName   = name,
        stationIndex = stationIndex,
        stationData  = station,
        stationLabel = label,
    })

    print(('^2[principallafy] %s (id=%s) abriu a mesa de DJ "%s"^0')
        :format(name, tostring(user_id), label))
end

RegisterCommand('somdebug', function(source)
    if source ~= 0 then return end

    print('^3=== principallafy diagnostico ===^0')
    print('vRP type: ' .. type(vRP))
    print('vRP.Passport: ' .. type(vRP and vRP.Passport))
    print('vRP.HasGroup: ' .. type(vRP and vRP.HasGroup))
    print('vRP.HasPermission: ' .. type(vRP and vRP.HasPermission))
    print('vRP.GetGroup: ' .. type(vRP and vRP.GetGroup))
    print('vRP.UserGroups: ' .. type(vRP and vRP.UserGroups))
    print('vRP.GetUserGroups: ' .. type(vRP and vRP.GetUserGroups))
    print('vRP.Identity: ' .. type(vRP and vRP.Identity))

    local players = GetPlayers()
    print('jogadores conectados: ' .. #players)

    for _, pid in ipairs(players) do
        local src = tonumber(pid)
        local passport = getPassport(src)
        print('-- ' .. GetPlayerName(src) .. ' (src=' .. src .. ', passport=' .. tostring(passport) .. ')')

        if passport then
            local ok1, r1 = pcall(function() return vRP.HasGroup(passport, 'Admin') end)
            print('   HasGroup(Admin) -> ok=' .. tostring(ok1) .. ' result=' .. tostring(r1))

            local ok1b, r1b = pcall(function() return vRP.HasGroup(passport, 'admin') end)
            print('   HasGroup(admin minusculo) -> ok=' .. tostring(ok1b) .. ' result=' .. tostring(r1b))

            if vRP.HasPermission then
                local ok2, r2 = pcall(function() return vRP.HasPermission(passport, 'Admin') end)
                print('   HasPermission(Admin) -> ok=' .. tostring(ok2) .. ' result=' .. tostring(r2))
            end

            if vRP.GetGroup then
                local ok3, r3 = pcall(function() return vRP.GetGroup(passport) end)
                print('   GetGroup() -> ok=' .. tostring(ok3) .. ' result=' .. tostring(r3))
            end

            if vRP.UserGroups then
                local ok4, r4 = pcall(function() return vRP.UserGroups(passport) end)
                print('   UserGroups() -> ok=' .. tostring(ok4) .. ' type=' .. type(r4))
                if type(r4) == 'table' then
                    for k, v in pairs(r4) do
                        print('     [' .. tostring(k) .. '] = ' .. tostring(v))
                    end
                end
            end

            if vRP.GetUserGroups then
                local ok5, r5 = pcall(function() return vRP.GetUserGroups(passport) end)
                print('   GetUserGroups() -> ok=' .. tostring(ok5) .. ' type=' .. type(r5))
                if type(r5) == 'table' then
                    for k, v in pairs(r5) do
                        print('     [' .. tostring(k) .. '] = ' .. tostring(v))
                    end
                end
            end
        end
    end

    print('^3=== fim diagnostico ===^0')
end, true)

RegisterCommand('som', function(source, args, rawCommand)
    if source == 0 then return end

    local user_id = getUserId(source)
    if not user_id then
        notify(source, 'negado', 'Nao foi possivel identificar seu usuario.')
        return
    end

    if not canUseSoundCommand(user_id) then
        notify(source, 'negado', getPermissions().deniedMessage)
        return
    end

    openMusicMenu(source, user_id)
end, false)

RegisterCommand('dj', function(source, args, rawCommand)
    if source == 0 then return end

    local user_id = getUserId(source)
    if not user_id then
        notify(source, 'negado', 'Nao foi possivel identificar seu usuario.')
        return
    end

    if not canUseDjCommand(user_id) then
        notify(source, 'negado', getPermissions().deniedMessage)
        return
    end

    local ped    = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    local maxDist = (DJConfig and DJConfig.interactionDistance) or 5.0

    local nearestIndex
    local nearestDist = math.huge
    for i, station in ipairs(DJStations) do
        local d = #(coords - station.coords)
        if d <= maxDist and d < nearestDist then
            nearestDist  = d
            nearestIndex = i
        end
    end

    if not nearestIndex then
        notify(source, 'negado', 'Voce precisa estar proximo de uma mesa de DJ.')
        return
    end

    openDjMenu(source, user_id, nearestIndex)
end, false)

RegisterCommand('somoff', function(source)
    if source == 0 then return end
    local user_id = getUserId(source)
    if not user_id then return end

    playerMuteStatus[source] = true
    notify(source, 'sucesso', 'Som mutado. Use /somon para desmutar.')
    TriggerClientEvent('music:setMuteStatus', source, true)
end, false)

RegisterCommand('somon', function(source)
    if source == 0 then return end
    local user_id = getUserId(source)
    if not user_id then return end

    playerMuteStatus[source] = false
    notify(source, 'sucesso', 'Som desmutado.')
    TriggerClientEvent('music:setMuteStatus', source, false)
end, false)

RegisterNetEvent('music:requestDJMenu')
AddEventHandler('music:requestDJMenu', function(stationIndex)
    local source  = source
    local user_id = getUserId(source)
    if not user_id then return end

    if not canUseDjCommand(user_id) then
        notify(source, 'negado', getPermissions().deniedMessage)
        return
    end

    openDjMenu(source, user_id, stationIndex)
end)

RegisterNetEvent('music:syncPlayerVolume')
AddEventHandler('music:syncPlayerVolume', function(volume)
    local source = source
    playerVolumeSettings[source] = volume

    local info = audioSources[source]
    if not info then return end

    local sourceCoords = info.sourceCoords
    for _, playerID in ipairs(GetPlayers()) do
        local pid = tonumber(playerID)
        if pid and pid ~= source and not playerMuteStatus[pid] then
            local ped = GetPlayerPed(pid)
            if DoesEntityExist(ped) then
                local d = #(sourceCoords - GetEntityCoords(ped))
                if d <= 150.0 then
                    TriggerClientEvent('music:updateSourceVolume', pid, {
                        sourcePlayer = source,
                        volume       = volume,
                    })
                end
            end
        end
    end
end)

RegisterNetEvent('music:updatePlayerPosition')
AddEventHandler('music:updatePlayerPosition', function(updateData)
    local source = source
    local now    = GetGameTimer()

    if lastPositionUpdate[source] and (now - lastPositionUpdate[source]) < positionUpdateInterval then
        return
    end
    lastPositionUpdate[source] = now

    playerPositions[source] = {
        playerCoords  = updateData.playerCoords,
        vehicleCoords = updateData.vehicleCoords,
        propNetId     = updateData.propNetId,
        vehicleNetId  = updateData.vehicleNetId,
        sourceType    = updateData.sourceType,
        lastUpdate    = now,
    }

    local info = audioSources[source]
    if not info then return end

    local sourceCoords = updateData.vehicleCoords or updateData.playerCoords
    info.sourceCoords = sourceCoords
    info.sourceType   = updateData.sourceType
    info.propNetId    = updateData.propNetId
    info.vehicleNetId = updateData.vehicleNetId
    info.lastUpdate   = now

    for _, playerID in ipairs(GetPlayers()) do
        local pid = tonumber(playerID)
        if pid and pid ~= source and not playerMuteStatus[pid] then
            local ped = GetPlayerPed(pid)
            if DoesEntityExist(ped) then
                local d = #(sourceCoords - GetEntityCoords(ped))
                if d <= 150.0 then
                    TriggerClientEvent('music:updateAudioSource', pid, {
                        sourcePlayer = source,
                        sourceCoords = sourceCoords,
                        sourceType   = updateData.sourceType,
                    })
                end
            end
        end
    end
end)

local oxmysql = exports.oxmysql

local function saveVideo(data)
    if not data or not data.id then return end

    local thumbnail = data.thumbnail or ('https://img.youtube.com/vi/' .. data.id .. '/mqdefault.jpg')
    local duration  = data.duration  or '--:--'
    local title     = data.title     or 'Sem titulo'

    MySQL.query('SELECT id FROM videos WHERE id = ?', { data.id }, function(result)
        if not result or #result == 0 then
            MySQL.query('INSERT INTO videos (id, title, thumbnail, duration) VALUES (?, ?, ?, ?)',
                { data.id, title, thumbnail, duration })
        else
            MySQL.query('UPDATE videos SET title = ?, thumbnail = ?, duration = ? WHERE id = ?',
                { title, thumbnail, duration, data.id })
        end
    end)

    storage.videos[data.id] = {
        id        = data.id,
        videoId   = data.id,
        title     = title,
        thumbnail = thumbnail,
        duration  = duration,
    }
    SaveResourceFile(GetCurrentResourceName(), 'storage.json', json.encode(storage), -1)
end

local function saveFavorite(source, data)
    local user_id = getUserId(source)
    if not user_id or not data or not data.id then return end

    saveVideo(data)

    MySQL.query('SELECT * FROM likes WHERE user_id = ? AND video_id = ?', { user_id, data.id }, function(result)
        if result and #result > 0 then
            MySQL.query('DELETE FROM likes WHERE user_id = ? AND video_id = ?', { user_id, data.id }, function()
                getFavoritesFor(source)
            end)
        else
            MySQL.query('INSERT INTO likes (user_id, video_id) VALUES (?, ?)', { user_id, data.id }, function()
                getFavoritesFor(source)
            end)
        end
    end)
end

local function saveToHistory(source, videoId)
    local user_id = getUserId(source)
    if not user_id then return end
    MySQL.query('INSERT INTO history (user_id, video_id) VALUES (?, ?)', { user_id, videoId }, function()
        getHistoryFor(source)
    end)
end

local function createPlaylist(source, name)
    local user_id = getUserId(source)
    if not user_id then return end
    MySQL.query('INSERT INTO playlists (user_id, name) VALUES (?, ?)', { user_id, name }, function()
        getPlaylistsFor(source)
    end)
end

local function addToPlaylist(source, playlistId, videoId)
    local user_id = getUserId(source)
    if not user_id then return end

    MySQL.query('SELECT id FROM playlists WHERE id = ? AND user_id = ?', { playlistId, user_id }, function(result)
        if not result or #result == 0 then return end
        MySQL.query('SELECT playlist_id FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
            { playlistId, videoId }, function(existing)
                if existing and #existing > 0 then return end
                MySQL.query('INSERT INTO playlist_videos (playlist_id, video_id) VALUES (?, ?)',
                    { playlistId, videoId })
            end)
    end)
end

function getPlaylistsFor(source)
    local user_id = getUserId(source)
    if not user_id then return end
    MySQL.query('SELECT id, name FROM playlists WHERE user_id = ?', { user_id }, function(result)
        TriggerClientEvent('music:playlistsData', source, result or {})
    end)
end

function getPlaylistVideosFor(source, playlistId)
    local user_id = getUserId(source)
    if not user_id then return end

    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration
        FROM playlist_videos pv
        JOIN videos v ON pv.video_id = v.id
        WHERE pv.playlist_id = ?
        ORDER BY pv.added_at DESC
    ]]

    MySQL.query(query, { playlistId }, function(result)
        local videos = {}
        for _, v in ipairs(result or {}) do
            videos[#videos + 1] = {
                id        = v.id,
                videoId   = v.id,
                title     = v.title,
                thumbnail = v.thumbnail or ('https://img.youtube.com/vi/' .. v.id .. '/mqdefault.jpg'),
                duration  = v.duration  or '--:--',
            }
        end
        TriggerClientEvent('music:playlistVideosData', source, videos)
    end)
end

function getFavoritesFor(source)
    local user_id = getUserId(source)
    if not user_id then return end

    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration
        FROM likes l
        JOIN videos v ON l.video_id = v.id
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
    ]]

    MySQL.query(query, { user_id }, function(result)
        local favorites = {}
        for _, v in ipairs(result or {}) do
            favorites[#favorites + 1] = {
                id        = v.id,
                videoId   = v.id,
                title     = v.title,
                thumbnail = v.thumbnail or ('https://img.youtube.com/vi/' .. v.id .. '/mqdefault.jpg'),
                duration  = v.duration  or '--:--',
            }
        end
        TriggerClientEvent('music:favoritesData', source, favorites)
    end)
end

function getHistoryFor(source)
    local user_id = getUserId(source)
    if not user_id then return end

    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration
        FROM history h
        JOIN videos v ON h.video_id = v.id
        WHERE h.user_id = ?
        ORDER BY h.played_at DESC
        LIMIT 100
    ]]

    MySQL.query(query, { user_id }, function(result)
        local history = {}
        for _, v in ipairs(result or {}) do
            history[#history + 1] = {
                id        = v.id,
                videoId   = v.id,
                title     = v.title,
                thumbnail = v.thumbnail or ('https://img.youtube.com/vi/' .. v.id .. '/mqdefault.jpg'),
                duration  = v.duration  or '--:--',
            }
        end
        TriggerClientEvent('music:historyData', source, history)
    end)
end

RegisterNetEvent('music:toggleFavorite')
AddEventHandler('music:toggleFavorite', function(data)
    saveFavorite(source, data)
end)

RegisterNetEvent('music:saveVideo')
AddEventHandler('music:saveVideo', function(data)
    saveVideo(data)
end)

RegisterNetEvent('music:saveToHistory')
AddEventHandler('music:saveToHistory', function(videoId)
    saveToHistory(source, videoId)
end)

RegisterNetEvent('music:createPlaylist')
AddEventHandler('music:createPlaylist', function(name)
    createPlaylist(source, name)
end)

RegisterNetEvent('music:addToPlaylist')
AddEventHandler('music:addToPlaylist', function(playlistId, videoId)
    addToPlaylist(source, playlistId, videoId)
end)

RegisterNetEvent('music:getPlaylists')
AddEventHandler('music:getPlaylists', function()
    getPlaylistsFor(source)
end)

RegisterNetEvent('music:getPlaylistVideos')
AddEventHandler('music:getPlaylistVideos', function(playlistId)
    getPlaylistVideosFor(source, playlistId)
end)

RegisterNetEvent('music:getFavorites')
AddEventHandler('music:getFavorites', function()
    getFavoritesFor(source)
end)

RegisterNetEvent('music:getHistory')
AddEventHandler('music:getHistory', function()
    getHistoryFor(source)
end)

RegisterNetEvent('music:removeFromPlaylist')
AddEventHandler('music:removeFromPlaylist', function(playlistId, videoId)
    local source  = source
    local user_id = getUserId(source)
    if not user_id or not playlistId or not videoId then return end

    MySQL.query('SELECT id FROM playlists WHERE id = ? AND user_id = ?', { playlistId, user_id }, function(result)
        if not result or #result == 0 then return end
        MySQL.query('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
            { playlistId, videoId })
    end)
end)

RegisterNetEvent('music:deletePlaylist')
AddEventHandler('music:deletePlaylist', function(playlistId)
    local source  = source
    local user_id = getUserId(source)
    if not user_id or not playlistId then return end

    MySQL.query('DELETE FROM playlists WHERE id = ? AND user_id = ?', { playlistId, user_id })
end)

RegisterNetEvent('principal:getFavorites')
AddEventHandler('principal:getFavorites', function()
    getFavoritesFor(source)
end)

RegisterNetEvent('music:getPlayerProfile')
AddEventHandler('music:getPlayerProfile', function()
    local source  = source
    local user_id = getUserId(source)
    local name    = getPlayerDisplayName(source, user_id)

    TriggerClientEvent('music:receivePlayerProfile', source, {
        name    = name,
        userId  = user_id,
        avatar  = (SharedConfig and SharedConfig.uiImages and SharedConfig.uiImages.avatarUrl) or '',
        banner  = (SharedConfig and SharedConfig.uiImages and SharedConfig.uiImages.bannerUrl) or '',
    })
end)

RegisterNetEvent('music:syncAudio')
AddEventHandler('music:syncAudio', function(audioData)
    local source = source
    local now    = GetGameTimer()

    if lastAudioSync[source] and (now - lastAudioSync[source]) < audioSyncInterval then
        return
    end
    lastAudioSync[source] = now

    audioSources[source] = {
        videoId      = audioData.videoId,
        title        = audioData.title,
        thumbnail    = audioData.thumbnail,
        duration     = audioData.duration,
        sourcePlayer = source,
        sourceCoords = audioData.sourceCoords,
        sourceType   = audioData.sourceType,
        propNetId    = audioData.propNetId,
        vehicleNetId = audioData.vehicleNetId,
        lastUpdate   = now,
    }

    local maxRange = 15.0
    if audioData.sourceType == 'vehicle' then maxRange = 20.0
    elseif audioData.sourceType == 'prop' then maxRange = 12.0 end

    for _, playerID in ipairs(GetPlayers()) do
        local pid = tonumber(playerID)
        if pid and pid ~= source and not playerMuteStatus[pid] then
            local ped = GetPlayerPed(pid)
            if DoesEntityExist(ped) then
                local d = #(audioData.sourceCoords - GetEntityCoords(ped))
                if d <= maxRange then
                    TriggerClientEvent('music:receiveAudio', pid, audioData)
                end
            end
        end
    end
end)

RegisterNetEvent('music:syncDJAudio')
AddEventHandler('music:syncDJAudio', function(audioData)
    local source = source
    local now    = GetGameTimer()

    if lastAudioSync[source] and (now - lastAudioSync[source]) < audioSyncInterval then
        return
    end
    lastAudioSync[source] = now

    local stationIndex = audioData.stationIndex
    local station      = DJStations[stationIndex]
    if not station then return end

    local djCoords = station.coords

    djSources[stationIndex] = {
        audioData    = audioData,
        sourceCoords = djCoords,
        sourceType   = 'dj',
        sourcePlayer = source,
        stationData  = station,
        lastUpdate   = now,
    }

    local syncData = {
        videoId      = audioData.videoId,
        title        = audioData.title,
        thumbnail    = audioData.thumbnail,
        duration     = audioData.duration,
        sourcePlayer = source,
        sourceCoords = djCoords,
        sourceType   = 'dj',
        stationIndex = stationIndex,
        stationData  = station,
        stationLabel = (station.displayName or station.name),
    }

    local maxRange = 30.0
    for _, playerID in ipairs(GetPlayers()) do
        local pid = tonumber(playerID)
        if pid and pid ~= source and not playerMuteStatus[pid] then
            local ped = GetPlayerPed(pid)
            if DoesEntityExist(ped) then
                local d = #(djCoords - GetEntityCoords(ped))
                if d <= maxRange then
                    TriggerClientEvent('music:receiveDJAudio', pid, syncData)
                end
            end
        end
    end
end)

RegisterNetEvent('music:stopAudio')
AddEventHandler('music:stopAudio', function()
    local source = source
    if not audioSources[source] then return end
    audioSources[source] = nil
    for _, playerID in ipairs(GetPlayers()) do
        if tonumber(playerID) ~= source then
            TriggerClientEvent('music:removeAudioSource', playerID, source)
        end
    end
end)

RegisterNetEvent('music:stopDJAudio')
AddEventHandler('music:stopDJAudio', function(stationIndex)
    local source = source
    if not djSources[stationIndex] then return end
    djSources[stationIndex] = nil
    for _, playerID in ipairs(GetPlayers()) do
        if tonumber(playerID) ~= source then
            TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
        end
    end
end)

RegisterNetEvent('music:updateAudioSource')
AddEventHandler('music:updateAudioSource', function(updateData)
    local source = source
    if not updateData or not updateData.sourceCoords then return end

    local info = audioSources[source]
    if not info then return end

    info.sourceCoords = updateData.sourceCoords
    info.sourceType   = updateData.sourceType
    info.propNetId    = updateData.propNetId
    info.vehicleNetId = updateData.vehicleNetId
    info.lastUpdate   = GetGameTimer()

    local maxRange = 15.0
    if updateData.sourceType == 'vehicle' then maxRange = 20.0
    elseif updateData.sourceType == 'dj'   then maxRange = 30.0 end

    for _, playerID in ipairs(GetPlayers()) do
        local pid = tonumber(playerID)
        if pid and pid ~= source then
            local ped = GetPlayerPed(pid)
            if DoesEntityExist(ped) then
                local d = #(updateData.sourceCoords - GetEntityCoords(ped))
                if d <= maxRange and not playerMuteStatus[pid] then
                    TriggerClientEvent('music:updateAudioSource', pid, {
                        sourcePlayer = source,
                        sourceCoords = updateData.sourceCoords,
                        sourceType   = updateData.sourceType,
                    })
                end
            end
        end
    end
end)

CreateThread(function()
    while true do
        Wait(2000)

        local now      = GetGameTimer()
        local processed = 0
        local maxPerCycle = 5

        for sourceId, info in pairs(audioSources) do
            if processed >= maxPerCycle then break end
            processed = processed + 1

            local ped = GetPlayerPed(sourceId)
            if DoesEntityExist(ped) then
                local newCoords
                local sourceType = info.sourceType

                if sourceType == 'prop' and info.propNetId then
                    local ent = NetworkGetEntityFromNetworkId(info.propNetId)
                    if ent ~= 0 and DoesEntityExist(ent) then
                        newCoords = GetEntityCoords(ent)
                    end
                elseif sourceType == 'vehicle' and info.vehicleNetId then
                    local ent = NetworkGetEntityFromNetworkId(info.vehicleNetId)
                    if ent ~= 0 and DoesEntityExist(ent) then
                        newCoords = GetEntityCoords(ent)
                    end
                else
                    newCoords = GetEntityCoords(ped)
                end

                if newCoords then
                    local moved = not info.sourceCoords or #(newCoords - info.sourceCoords) > 5.0
                    if moved then
                        info.sourceCoords = newCoords
                        info.lastUpdate   = now

                        local maxRange = 15.0
                        if sourceType == 'vehicle' then maxRange = 20.0
                        elseif sourceType == 'prop' then maxRange = 12.0 end

                        for _, playerID in ipairs(GetPlayers()) do
                            local pid = tonumber(playerID)
                            if pid and pid ~= sourceId and not playerMuteStatus[pid] then
                                local tped = GetPlayerPed(pid)
                                if DoesEntityExist(tped) then
                                    local d = #(newCoords - GetEntityCoords(tped))
                                    if d <= maxRange then
                                        TriggerClientEvent('music:updateAudioSource', pid, {
                                            sourcePlayer = sourceId,
                                            sourceCoords = newCoords,
                                            sourceType   = sourceType,
                                        })
                                    end
                                end
                            end
                        end
                    end
                end
            else
                audioSources[sourceId] = nil
                for _, playerID in ipairs(GetPlayers()) do
                    if tonumber(playerID) ~= sourceId then
                        TriggerClientEvent('music:removeAudioSource', playerID, sourceId)
                    end
                end
            end
        end

        if processed < maxPerCycle then
            for stationIndex, info in pairs(djSources) do
                if processed >= maxPerCycle then break end
                processed = processed + 1

                local sourceId = info.sourcePlayer
                local ped      = GetPlayerPed(sourceId)

                if DoesEntityExist(ped) then
                    info.lastUpdate = now
                    local d = #(GetEntityCoords(ped) - info.sourceCoords)
                    if d > 15.0 then
                        djSources[stationIndex] = nil
                        for _, playerID in ipairs(GetPlayers()) do
                            TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
                        end
                    end
                else
                    djSources[stationIndex] = nil
                    for _, playerID in ipairs(GetPlayers()) do
                        TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
                    end
                end
            end
        end
    end
end)

CreateThread(function()
    while true do
        Wait(5000)

        for sourceId, _ in pairs(audioSources) do
            if not DoesEntityExist(GetPlayerPed(sourceId)) then
                audioSources[sourceId] = nil
                for _, playerID in ipairs(GetPlayers()) do
                    if tonumber(playerID) ~= sourceId then
                        TriggerClientEvent('music:removeAudioSource', playerID, sourceId)
                    end
                end
            end
        end

        for stationIndex, info in pairs(djSources) do
            if not DoesEntityExist(GetPlayerPed(info.sourcePlayer)) then
                djSources[stationIndex] = nil
                for _, playerID in ipairs(GetPlayers()) do
                    TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
                end
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local source = source
    audioSources[source]      = nil
    playerMuteStatus[source]  = nil
    playerPositions[source]   = nil
    playerVolumeSettings[source] = nil
    lastPositionUpdate[source]   = nil
    lastAudioSync[source]        = nil

    for stationIndex, info in pairs(djSources) do
        if info.sourcePlayer == source then
            djSources[stationIndex] = nil
            for _, playerID in ipairs(GetPlayers()) do
                TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
            end
        end
    end

    for _, playerID in ipairs(GetPlayers()) do
        TriggerClientEvent('music:removeAudioSource', playerID, source)
    end
end)
