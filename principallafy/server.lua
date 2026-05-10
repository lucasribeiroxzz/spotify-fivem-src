
local Tunnel = module("vrp", "lib/Tunnel")
local Proxy = module("vrp", "lib/Proxy")
vRP = Proxy.getInterface("vRP")

local djStationsFile = LoadResourceFile(GetCurrentResourceName(), "config/dj_stations.lua")
if djStationsFile then
    load(djStationsFile)()
else
    print("^1[ERRO] Não foi possível carregar config/dj_stations.lua^0")
    DJStations = {}
    DJConfig = {}
end

local lastPositionUpdate = {}
local positionUpdateInterval = 500
local lastAudioSync = {}
local audioSyncInterval = 1000

local Config = {}
local SharedConfig = {}
local audioSources = {}
local djSources = {}
local playerMuteStatus = {}
local playerPositions = {}
local Debug = true

local playerVolumeSettings = {}

function DebugLog(message)
    if Debug then
    end
end

Citizen.CreateThread(function()
    Config = LoadResourceFile(GetCurrentResourceName(), "config.lua")
    Config = load(Config)()
    
    SharedConfig = LoadResourceFile(GetCurrentResourceName(), "shared/config.lua")
    SharedConfig = load(SharedConfig)()
    
    DebugLog("Configurações carregadas")
end)

local storage = {
    favorites = {},
    playlists = {},
    history = {},
    videos = {}
}

Citizen.CreateThread(function()
    local storageFile = LoadResourceFile(GetCurrentResourceName(), "storage.json")
    if storageFile then
        local success, loadedStorage = pcall(function()
            return json.decode(storageFile)
        end)
        
        if success and loadedStorage then
            storage = loadedStorage
            DebugLog("Armazenamento carregado do arquivo")
        else
            DebugLog("Erro ao carregar armazenamento, usando novo")
        end
    else
        DebugLog("Arquivo de armazenamento não encontrado, usando novo")
    end
end)

function GetPlayerId(source)
    if source then
        local user_id = vRP.getUserId({source})
        if user_id then
            return tonumber(user_id)
        end
    end
    
    return tonumber(source)
end

RegisterCommand('somoff', function(source, args, rawCommand)
    
    local user_id = vRP.getUserId(source)
    if not user_id then return end

    playerMuteStatus[source] = true

    TriggerClientEvent('Notify', source, 'sucesso', 'Som mutado! Use /somon para desmutar.')
    TriggerClientEvent('music:setMuteStatus', source, true)
    DebugLog("Jogador " .. source .. " mutou o som")
end)

RegisterCommand('somon', function(source, args, rawCommand)
    
    local user_id = vRP.getUserId(source)
    if not user_id then return end

    playerMuteStatus[source] = false

    TriggerClientEvent('Notify', source, 'sucesso', 'Som desmutado!')
    TriggerClientEvent('music:setMuteStatus', source, false)
    DebugLog("Jogador " .. source .. " desmutou o som")
end)

RegisterNetEvent('music:syncPlayerVolume')
AddEventHandler('music:syncPlayerVolume', function(volume)
    local source = source
    
    playerVolumeSettings[source] = volume
    
    if audioSources[source] then
        local sourceCoords = audioSources[source].sourceCoords
        
        for _, playerID in ipairs(GetPlayers()) do
            local playerNum = tonumber(playerID)
            if playerNum and playerNum ~= source and not playerMuteStatus[playerNum] then
                local targetPed = GetPlayerPed(playerNum)
                if DoesEntityExist(targetPed) then
                    local targetCoords = GetEntityCoords(targetPed)
                    local distance = #(sourceCoords - targetCoords)
                    
                    if distance <= 150.0 then
                        TriggerClientEvent('music:updateSourceVolume', playerNum, {
                            sourcePlayer = source,
                            volume = volume
                        })
                    end
                end
            end
        end
    end
    
    DebugLog("Volume do jogador " .. source .. " sincronizado: " .. volume .. "%")
end)

RegisterNetEvent('music:requestDJMenu')
AddEventHandler('music:requestDJMenu', function(stationIndex)
    
    local source = source
    local user_id = vRP.getUserId(source)
    if not user_id then return end
    
    if not DJStations[stationIndex] then
        TriggerClientEvent('Notify', source, 'negado', 'Mesa de DJ inválida.')
        return
    end
    
    local station = DJStations[stationIndex]
    local playerPed = GetPlayerPed(source)
    local playerCoords = GetEntityCoords(playerPed)
    local distance = #(playerCoords - station.coords)
    
    if distance > (DJConfig.interactionDistance or 3.0) then
        TriggerClientEvent('Notify', source, 'negado', 'Você está muito longe da mesa de DJ.')
        return
    end
    
    if station.requireItem and station.item then
        if not vRP.hasInventoryItem(user_id, station.item, 1) then
            TriggerClientEvent('Notify', source, 'negado', 'Você precisa do item: ' .. station.item)
            return
        end
    end
    
    if not DJConfig.allowMultipleDJs and djSources[stationIndex] then
        TriggerClientEvent('Notify', source, 'negado', 'Esta mesa de DJ já está sendo usada.')
        return
    end
    
    local identity = vRP.getUserIdentity(user_id)
    local playerName = GetPlayerName(source)
    
    if identity then
        playerName = identity.nome .. " " .. identity.sobrenome
    end
    
    TriggerClientEvent('principal:openDJMenu', source, {
        playerName = playerName,
        stationIndex = stationIndex,
        stationData = station
    })
    
    DebugLog("Jogador " .. source .. " abriu a mesa de DJ: " .. station.name)
end)

RegisterCommand('dj', function(source, args, rawCommand)
    
    local user_id = vRP.getUserId(source)
    if not user_id then return end
    
    local playerPed = GetPlayerPed(source)
    local playerCoords = GetEntityCoords(playerPed)
    local nearestStation = nil
    local nearestDistance = math.huge
    
    for i, station in ipairs(DJStations) do
        local distance = #(playerCoords - station.coords)
        if distance <= (DJConfig.interactionDistance or 3.0) and distance < nearestDistance then
            nearestDistance = distance
            nearestStation = {index = i, data = station}
        end
    end
    
    if not nearestStation then
        TriggerClientEvent('Notify', source, 'negado', 'Você precisa estar próximo de uma mesa de DJ para usar este comando.')
        return
    end
    
    TriggerEvent('music:requestDJMenu', nearestStation.index)
end)

RegisterNetEvent('music:updatePlayerPosition')
AddEventHandler('music:updatePlayerPosition', function(updateData)
    local source = source
    local currentTime = GetGameTimer()
    
    if lastPositionUpdate[source] and (currentTime - lastPositionUpdate[source]) < positionUpdateInterval then
        return
    end
    
    lastPositionUpdate[source] = currentTime
    
    playerPositions[source] = {
        playerCoords = updateData.playerCoords,
        vehicleCoords = updateData.vehicleCoords,
        propNetId = updateData.propNetId,
        vehicleNetId = updateData.vehicleNetId,
        sourceType = updateData.sourceType,
        lastUpdate = currentTime
    }
    
    if audioSources[source] then
        local sourceCoords = updateData.vehicleCoords or updateData.playerCoords
        
        audioSources[source].sourceCoords = sourceCoords
        audioSources[source].sourceType = updateData.sourceType
        audioSources[source].propNetId = updateData.propNetId
        audioSources[source].vehicleNetId = updateData.vehicleNetId
        audioSources[source].lastUpdate = currentTime
        
        local nearbyPlayers = {}
        for _, playerID in ipairs(GetPlayers()) do
            local playerNum = tonumber(playerID)
            if playerNum and playerNum ~= source and not playerMuteStatus[playerNum] then
                local targetPed = GetPlayerPed(playerNum)
                if DoesEntityExist(targetPed) then
                    local targetCoords = GetEntityCoords(targetPed)
                    local distance = #(sourceCoords - targetCoords)
                    
                    if distance <= 150.0 then
                        table.insert(nearbyPlayers, playerNum)
                    end
                end
            end
        end
        
        if #nearbyPlayers > 0 then
            for _, playerNum in ipairs(nearbyPlayers) do
                TriggerClientEvent('music:updateAudioSource', playerNum, {
                    sourcePlayer = source,
                    sourceCoords = sourceCoords,
                    sourceType = updateData.sourceType
                })
            end
        end
    end
end)

function SaveFavorite(source, data)
    local user_id = GetPlayerId(source)
    DebugLog("Salvando favorito para jogador: " .. user_id)
    
    SaveVideo(source, data)
    
    MySQL.query("SELECT * FROM likes WHERE user_id = ? AND video_id = ?", {user_id, data.id}, function(result)
        if result and #result > 0 then
            MySQL.query("DELETE FROM likes WHERE user_id = ? AND video_id = ?", {user_id, data.id}, function()
                DebugLog("Favorito removido: " .. data.id)
                GetFavorites(source)
            end)
        else
            MySQL.query("INSERT INTO likes (user_id, video_id) VALUES (?, ?)", {user_id, data.id}, function()
                DebugLog("Favorito adicionado: " .. data.id)
                GetFavorites(source)
            end)
        end
    end)
end

function SaveToHistory(source, videoId)
    local user_id = GetPlayerId(source)
    DebugLog("Salvando histórico para jogador: " .. user_id)
    
    MySQL.query("INSERT INTO history (user_id, video_id) VALUES (?, ?)", {user_id, videoId}, function()
        GetHistory(source)
    end)
end

function SaveVideo(source, data)
    if not data or not data.id then return end
    DebugLog("Salvando vídeo: " .. data.id)
    
    MySQL.query("SELECT id FROM videos WHERE id = ?", {data.id}, function(result)
        if not result or #result == 0 then
            MySQL.query("INSERT INTO videos (id, title, thumbnail, duration) VALUES (?, ?, ?, ?)", 
                {data.id, data.title, data.thumbnail, data.duration}, function()
                DebugLog("Vídeo adicionado ao banco: " .. data.id)
            end)
        else
            MySQL.query("UPDATE videos SET title = ?, thumbnail = ?, duration = ? WHERE id = ?", 
                {data.title, data.thumbnail, data.duration, data.id}, function()
                DebugLog("Vídeo atualizado no banco: " .. data.id)
            end)
        end
    end)
    
    storage.videos[data.id] = {
        id = data.id,
        videoId = data.id,
        title = data.title,
        thumbnail = data.thumbnail or "https://img.youtube.com/vi/" .. data.id .. "/mqdefault.jpg",
        duration = data.duration or "--:--"
    }
    
    SaveResourceFile(GetCurrentResourceName(), "storage.json", json.encode(storage), -1)
end

function CreatePlaylist(source, name)
    local user_id = GetPlayerId(source)
    DebugLog("Criando playlist para jogador: " .. user_id .. ", nome: " .. name)
    
    MySQL.query("INSERT INTO playlists (user_id, name) VALUES (?, ?)", {user_id, name}, function()
        GetPlaylists(source)
    end)
end

function AddToPlaylist(source, playlistId, videoId)
    local user_id = GetPlayerId(source)
    DebugLog("Adicionando à playlist: " .. playlistId .. ", vídeo: " .. videoId)
    
    MySQL.query("SELECT id FROM playlists WHERE id = ? AND user_id = ?", {playlistId, user_id}, function(result)
        if not result or #result == 0 then
            DebugLog("Playlist não encontrada ou não pertence ao usuário: " .. playlistId)
            return
        end
        
        MySQL.query("SELECT playlist_id FROM playlist_videos WHERE playlist_id = ? AND video_id = ?", {playlistId, videoId}, function(result2)
            if result2 and #result2 > 0 then
                DebugLog("Vídeo já está na playlist")
                return
            end
            
            MySQL.query("INSERT INTO playlist_videos (playlist_id, video_id) VALUES (?, ?)", {playlistId, videoId}, function()
                DebugLog("Vídeo adicionado à playlist")
            end)
        end)
    end)
end

function GetPlaylists(source)
    local user_id = GetPlayerId(source)
    DebugLog("Obtendo playlists para jogador: " .. user_id)
    
    MySQL.query("SELECT id, name FROM playlists WHERE user_id = ?", {user_id}, function(result)
        if not result then result = {} end
        
        DebugLog("Encontradas " .. #result .. " playlists")
        
        TriggerClientEvent('music:playlistsData', source, result)
    end)
end

function GetPlaylistVideos(source, playlistId)
    local user_id = GetPlayerId(source)
    DebugLog("Obtendo vídeos da playlist: " .. playlistId)
    
    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration 
        FROM playlist_videos pv 
        JOIN videos v ON pv.video_id = v.id 
        WHERE pv.playlist_id = ?
        ORDER BY pv.added_at DESC
    ]]
    
    MySQL.query(query, {playlistId}, function(result)
        if not result then result = {} end
        
        DebugLog("Encontrados " .. #result .. " vídeos na playlist")
        
        local videos = {}
        for _, video in ipairs(result) do
            table.insert(videos, {
                id = video.id,
                videoId = video.id,
                title = video.title,
                thumbnail = video.thumbnail or "https://img.youtube.com/vi/" .. video.id .. "/mqdefault.jpg",
                duration = video.duration or "--:--"
            })
        end
        
        TriggerClientEvent('music:playlistVideosData', source, videos)
    end)
end

function GetFavorites(source)
    local user_id = GetPlayerId(source)
    DebugLog("Obtendo favoritos para jogador: " .. user_id)
    
    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration 
        FROM likes l 
        JOIN videos v ON l.video_id = v.id 
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
    ]]
    
    MySQL.query(query, {user_id}, function(result)
        if not result then result = {} end
        
        DebugLog("Encontrados " .. #result .. " favoritos")
        
        local favorites = {}
        for _, video in ipairs(result) do
            table.insert(favorites, {
                id = video.id,
                videoId = video.id,
                title = video.title,
                thumbnail = video.thumbnail or "https://img.youtube.com/vi/" .. video.id .. "/mqdefault.jpg",
                duration = video.duration or "--:--"
            })
        end
        
        TriggerClientEvent('music:favoritesData', source, favorites)
    end)
end

function GetHistory(source)
    local user_id = GetPlayerId(source)
    DebugLog("Obtendo histórico para jogador: " .. user_id)
    
    local query = [[
        SELECT v.id, v.title, v.thumbnail, v.duration 
        FROM history h 
        JOIN videos v ON h.video_id = v.id 
        WHERE h.user_id = ?
        ORDER BY h.played_at DESC
        LIMIT 100
    ]]
    
    MySQL.query(query, {user_id}, function(result)
        if not result then result = {} end
        
        DebugLog("Encontrados " .. #result .. " itens no histórico")
        
        local history = {}
        for _, video in ipairs(result) do
            table.insert(history, {
                id = video.id,
                videoId = video.id,
                title = video.title,
                thumbnail = video.thumbnail or "https://img.youtube.com/vi/" .. video.id .. "/mqdefault.jpg",
                duration = video.duration or "--:--"
            })
        end
        
        TriggerClientEvent('music:historyData', source, history)
    end)
end

local oxmysql = exports.oxmysql

function AddToHistory(source, video)
    local user_id = GetPlayerId(source)
    if not user_id or not video or not video.id then return end

    local videoId = video.id
    local title = video.title or "Sem título"
    local thumbnail = video.thumbnail or ("https://img.youtube.com/vi/" .. videoId .. "/mqdefault.jpg")
    local duration = video.duration or "--:--"

    CreateThread(function()
        local result = oxmysql:query_async("SELECT id FROM videos WHERE id = ?", { videoId })

        if not result or #result == 0 then
            oxmysql:execute_async("INSERT INTO videos (id, title, thumbnail, duration) VALUES (?, ?, ?, ?)", {
                videoId, title, thumbnail, duration
            })
        end

        oxmysql:execute_async("INSERT INTO history (user_id, video_id) VALUES (?, ?)", {
            user_id, videoId
        })
    end)
end

RegisterCommand('som', function(source, args, rawCommand)
    
    local user_id = vRP.getUserId(source)
    if user_id then
        local identity = vRP.getUserIdentity(user_id)
        local playerName = GetPlayerName(source)

        if identity then
            playerName = identity.nome .. " " .. identity.sobrenome
        end

        print("^2[SOM] Player "..playerName.." ("..source..") usou comando som^7")
        TriggerClientEvent('principal:openMusicMenu', source, playerName)
    end
end)

RegisterNetEvent('music:toggleFavorite')
AddEventHandler('music:toggleFavorite', function(data)
    local source = source
    DebugLog("Evento toggleFavorite recebido de: " .. source)
    SaveFavorite(source, data)
end)

RegisterNetEvent('music:saveVideo')
AddEventHandler('music:saveVideo', function(data)
    local source = source
    DebugLog("Evento saveVideo recebido de: " .. source)
    SaveVideo(source, data)
end)

RegisterNetEvent('music:saveToHistory')
AddEventHandler('music:saveToHistory', function(videoId)
    local source = source
    DebugLog("Evento saveToHistory recebido de: " .. source)
    SaveToHistory(source, videoId)
end)

RegisterNetEvent('music:createPlaylist')
AddEventHandler('music:createPlaylist', function(name)
    local source = source
    DebugLog("Evento createPlaylist recebido de: " .. source)
    CreatePlaylist(source, name)
end)

RegisterNetEvent('music:addToPlaylist')
AddEventHandler('music:addToPlaylist', function(playlistId, videoId)
    local source = source
    DebugLog("Evento addToPlaylist recebido de: " .. source)
    AddToPlaylist(source, playlistId, videoId)
end)

RegisterNetEvent('music:getPlaylists')
AddEventHandler('music:getPlaylists', function()
    local source = source
    DebugLog("Evento getPlaylists recebido de: " .. source)
    GetPlaylists(source)
end)

RegisterNetEvent('music:getPlaylistVideos')
AddEventHandler('music:getPlaylistVideos', function(playlistId)
    local source = source
    DebugLog("Evento getPlaylistVideos recebido de: " .. source)
    GetPlaylistVideos(source, playlistId)
end)

RegisterNetEvent('music:getFavorites')
AddEventHandler('music:getFavorites', function()
    local source = source
    DebugLog("Evento getFavorites recebido de: " .. source)
    GetFavorites(source)
end)

RegisterNetEvent('music:getHistory')
AddEventHandler('music:getHistory', function()
    local source = source
    DebugLog("Evento getHistory recebido de: " .. source)
    GetHistory(source)
end)

RegisterNetEvent('music:syncAudio')
AddEventHandler('music:syncAudio', function(audioData)
    local source = source
    local currentTime = GetGameTimer()
    
    if lastAudioSync[source] and (currentTime - lastAudioSync[source]) < audioSyncInterval then
        DebugLog("🎵 Sincronização ignorada - muito frequente para jogador: " .. source)
        return
    end
    
    lastAudioSync[source] = currentTime
    
    DebugLog("🎵 === SINCRONIZANDO ÁUDIO NORMAL (OTIMIZADO) ===")
    DebugLog("🎵 Fonte: " .. source .. " (" .. audioData.sourceType .. ")")

    audioSources[source] = {
        videoId = audioData.videoId,
        title = audioData.title,
        thumbnail = audioData.thumbnail,
        duration = audioData.duration,
        sourcePlayer = source,
        sourceCoords = audioData.sourceCoords,
        sourceType = audioData.sourceType,
        propNetId = audioData.propNetId,
        vehicleNetId = audioData.vehicleNetId,
        lastUpdate = currentTime
    }

    local maxRange = 15.0
    if audioData.sourceType == "vehicle" then
        maxRange = 20.0
    elseif audioData.sourceType == "prop" then
        maxRange = 12.0
    end

    local nearbyPlayers = {}
    for _, playerID in ipairs(GetPlayers()) do
        local playerNum = tonumber(playerID)
        if playerNum and playerNum ~= source and not playerMuteStatus[playerNum] then
            local targetPed = GetPlayerPed(playerNum)
            if DoesEntityExist(targetPed) then
                local targetCoords = GetEntityCoords(targetPed)
                local distance = #(audioData.sourceCoords - targetCoords)

                if distance <= maxRange then
                    table.insert(nearbyPlayers, {
                        playerId = playerNum,
                        distance = distance
                    })
                end
            end
        end
    end

    DebugLog("🎵 Propagando áudio para " .. #nearbyPlayers .. " jogadores próximos")

    for _, playerData in ipairs(nearbyPlayers) do
        TriggerClientEvent('music:receiveAudio', playerData.playerId, audioData)
    end
end)

RegisterNetEvent('music:syncDJAudio')
AddEventHandler('music:syncDJAudio', function(audioData)
    local source = source
    local currentTime = GetGameTimer()
    
    if lastAudioSync[source] and (currentTime - lastAudioSync[source]) < audioSyncInterval then
        DebugLog("🎧 Sincronização DJ ignorada - muito frequente para jogador: " .. source)
        return
    end
    
    lastAudioSync[source] = currentTime
    
    DebugLog("🎧 Sincronizando áudio de DJ de " .. tostring(source))

    local stationIndex = audioData.stationIndex
    local stationData = DJStations[stationIndex]

    if not stationData then
        DebugLog("Mesa de DJ inválida: " .. tostring(stationIndex))
        return
    end

    local djCoords = stationData.coords

    djSources[stationIndex] = {
        audioData = audioData,
        sourceCoords = djCoords,
        sourceType = "dj",
        sourcePlayer = source,
        stationData = stationData,
        lastUpdate = currentTime
    }

    local syncData = {
        videoId = audioData.videoId,
        title = audioData.title,
        thumbnail = audioData.thumbnail,
        duration = audioData.duration,
        sourcePlayer = source,
        sourceCoords = djCoords,
        sourceType = "dj",
        stationIndex = stationIndex,
        stationData = stationData
    }

    local maxRange = 30.0
    local nearbyPlayers = {}
    
    for _, playerID in ipairs(GetPlayers()) do
        local playerNum = tonumber(playerID)
        if playerNum and playerNum ~= source and not playerMuteStatus[playerNum] then
            local targetPed = GetPlayerPed(playerNum)
            if DoesEntityExist(targetPed) then
                local targetCoords = GetEntityCoords(targetPed)
                local distance = #(djCoords - targetCoords)

                if distance <= maxRange then
                    table.insert(nearbyPlayers, {
                        playerId = playerNum,
                        distance = distance
                    })
                end
            end
        end
    end
    
    DebugLog("🎧 Propagando áudio de DJ para " .. #nearbyPlayers .. " jogadores")
    
    for _, playerData in ipairs(nearbyPlayers) do
        TriggerClientEvent('music:receiveDJAudio', playerData.playerId, syncData)
    end
end)

RegisterNetEvent('music:stopAudio')
AddEventHandler('music:stopAudio', function()
    local source = source
    DebugLog("Parando áudio de " .. source)
    
    if audioSources[source] then
        audioSources[source] = nil
        
        for _, playerID in ipairs(GetPlayers()) do
            if tonumber(playerID) ~= source then
                TriggerClientEvent('music:removeAudioSource', playerID, source)
            end
        end
    end
end)

RegisterNetEvent('music:stopDJAudio')
AddEventHandler('music:stopDJAudio', function(stationIndex)
    local source = source
    DebugLog("Parando áudio de DJ de " .. source .. " na mesa " .. stationIndex)
    
    if djSources[stationIndex] then
        djSources[stationIndex] = nil
        
        for _, playerID in ipairs(GetPlayers()) do
            if tonumber(playerID) ~= source then
                TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
            end
        end
    end
end)

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        
        local currentTime = GetGameTimer()
        
        local processedSources = 0
        local maxProcessPerCycle = 5
        
        for sourceId, sourceInfo in pairs(audioSources) do
            if processedSources >= maxProcessPerCycle then break end
            processedSources = processedSources + 1
            
            local playerPed = GetPlayerPed(sourceId)
            if DoesEntityExist(playerPed) then
                local newCoords = nil
                local sourceType = sourceInfo.sourceType
                
                if sourceType == "prop" and sourceInfo.propNetId then
                    local propEntity = NetworkGetEntityFromNetworkId(sourceInfo.propNetId)
                    if propEntity and propEntity ~= 0 and DoesEntityExist(propEntity) then
                        newCoords = GetEntityCoords(propEntity)
                    end
                elseif sourceType == "vehicle" and sourceInfo.vehicleNetId then
                    local vehicleEntity = NetworkGetEntityFromNetworkId(sourceInfo.vehicleNetId)
                    if vehicleEntity and vehicleEntity ~= 0 and DoesEntityExist(vehicleEntity) then
                        newCoords = GetEntityCoords(vehicleEntity)
                    end
                else
                    newCoords = GetEntityCoords(playerPed)
                end
                
                if newCoords then
                    local oldCoords = sourceInfo.sourceCoords
                    local moved = not oldCoords or #(newCoords - oldCoords) > 5.0
                    
                    if moved then
                        sourceInfo.sourceCoords = newCoords
                        sourceInfo.lastUpdate = currentTime
                        
                        local maxRange = 15.0
                        if sourceType == "vehicle" then
                            maxRange = 20.0
                        elseif sourceType == "prop" then
                            maxRange = 12.0
                        end
                        
                        local playersToUpdate = {}
                        for _, playerID in ipairs(GetPlayers()) do
                            local playerNum = tonumber(playerID)
                            if playerNum and playerNum ~= sourceId and not playerMuteStatus[playerNum] then
                                local targetPed = GetPlayerPed(playerNum)
                                if DoesEntityExist(targetPed) then
                                    local targetCoords = GetEntityCoords(targetPed)
                                    local distance = #(newCoords - targetCoords)
                                    
                                    if distance <= maxRange then
                                        table.insert(playersToUpdate, playerNum)
                                    end
                                end
                            end
                        end
                        
                        for _, playerNum in ipairs(playersToUpdate) do
                            TriggerClientEvent('music:updateAudioSource', playerNum, {
                                sourcePlayer = sourceId,
                                sourceCoords = newCoords,
                                sourceType = sourceType
                            })
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
        
        if processedSources < maxProcessPerCycle then
            for stationIndex, djInfo in pairs(djSources) do
                if processedSources >= maxProcessPerCycle then break end
                processedSources = processedSources + 1
                
                local sourceId = djInfo.sourcePlayer
                local playerPed = GetPlayerPed(sourceId)
                
                if DoesEntityExist(playerPed) then
                    djInfo.lastUpdate = currentTime
                    
                    local playerCoords = GetEntityCoords(playerPed)
                    local distance = #(playerCoords - djInfo.sourceCoords)
                    
                    if distance > 15.0 then
                        djSources[stationIndex] = nil
                        for _, playerID in ipairs(GetPlayers()) do
                            TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
                        end
                        DebugLog("DJ " .. sourceId .. " se afastou da mesa " .. stationIndex)
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

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        
        for sourceId, sourceInfo in pairs(audioSources) do
            local playerPed = GetPlayerPed(sourceId)
            if not DoesEntityExist(playerPed) then
                audioSources[sourceId] = nil
                for _, playerID in ipairs(GetPlayers()) do
                    if tonumber(playerID) ~= sourceId then
                        TriggerClientEvent('music:removeAudioSource', playerID, sourceId)
                    end
                end
                DebugLog("Fonte de áudio removida (player desconectou): " .. sourceId)
            end
        end
        
        for stationIndex, djInfo in pairs(djSources) do
            local sourceId = djInfo.sourcePlayer
            local playerPed = GetPlayerPed(sourceId)
            
            if not DoesEntityExist(playerPed) then
                djSources[stationIndex] = nil
                for _, playerID in ipairs(GetPlayers()) do
                    TriggerClientEvent('music:removeDJAudioSource', playerID, stationIndex)
                end
                DebugLog("Fonte de áudio de DJ removida (DJ desconectou): " .. stationIndex)
            end
        end
    end
end)

RegisterNetEvent('principal:getFavorites')
AddEventHandler('principal:getFavorites', function(userId)
    local source = source
    DebugLog("Evento principal:getFavorites recebido para usuário: " .. userId)
    GetFavorites(source)
end)

RegisterNetEvent('music:updateAudioSource')
AddEventHandler('music:updateAudioSource', function(updateData)
    local source = source
    
    if not updateData.sourceCoords then
        DebugLog("ERRO: updateAudioSource sem coordenadas da fonte!")
        return
    end
    
    if audioSources[source] then
        audioSources[source].sourceCoords = updateData.sourceCoords
        audioSources[source].sourceType = updateData.sourceType
        audioSources[source].propNetId = updateData.propNetId
        audioSources[source].vehicleNetId = updateData.vehicleNetId
        audioSources[source].lastUpdate = GetGameTimer()
        
        DebugLog("Fonte " .. source .. " (" .. updateData.sourceType .. ") atualizada: " .. 
            string.format("%.1f, %.1f, %.1f", updateData.sourceCoords.x, updateData.sourceCoords.y, updateData.sourceCoords.z))
        
        local maxRange = 15.0
        if updateData.sourceType == "vehicle" then
            maxRange = 20.0
        elseif updateData.sourceType == "dj" then
            maxRange = 30.0
        end
        
        for _, playerID in ipairs(GetPlayers()) do
            local playerNum = tonumber(playerID)
            if playerNum and playerNum ~= source then
                local targetPed = GetPlayerPed(playerNum)
                if DoesEntityExist(targetPed) then
                    local targetCoords = GetEntityCoords(targetPed)
                    local distance = #(updateData.sourceCoords - targetCoords)
                    
                    if distance <= maxRange and not playerMuteStatus[playerNum] then
                        TriggerClientEvent('music:updateAudioSource', playerNum, {
                            sourcePlayer = source,
                            sourceCoords = updateData.sourceCoords,
                            sourceType = updateData.sourceType
                        })
                    end
                end
            end
        end
    end
end)
