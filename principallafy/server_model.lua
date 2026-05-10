RegisterCommand('sommodel', function(source, args, raw)
    local src = source
    local newModel = args[1]

    if not newModel or newModel == '' then
        if src ~= 0 then
            TriggerClientEvent('chat:addMessage', src, { args = { '⚠️ Uso', '/sommodel <nome_do_modelo>' } })
        else
            print('[PRINCIPAL] Uso: /sommodel <nome_do_modelo>')
        end
        return
    end

    TriggerClientEvent('principal:setPropModel', src, newModel)

    if src ~= 0 then
        TriggerClientEvent('chat:addMessage', src, { args = { '✅ Modelo atualizado para', newModel } })
    else
        print('[PRINCIPAL] Modelo atualizado para: ' .. tostring(newModel))
    end
end, false)