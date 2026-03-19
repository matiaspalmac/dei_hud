-- ============================================================
-- Dei Ecosystem - Server Startup
-- ============================================================
CreateThread(function()
    Wait(2000)

    local v = GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '1.0'

    local deiResources = {
        'dei_hud', 'dei_chat', 'dei_notifys', 'dei_pausemenu',
        'dei_scoreboard', 'dei_progressbar', 'dei_input', 'dei_drift',
        'dei_loadingscreen', 'dei_multichar', 'dei_radio', 'dei_garage',
        'dei_doorlock', 'dei_billing', 'dei_vehicleshop', 'dei_clothing',
        'dei_admin'
    }

    local active = {}
    for _, res in ipairs(deiResources) do
        if GetResourceState(res) == 'started' then
            local name = res:gsub('dei_', '')
            table.insert(active, name)
        end
    end

    print('')
    print('^4========================================^0')
    print('^4  Dei Ecosystem ^7v' .. v .. '^0')
    print('^4  ^2' .. #active .. ' recursos activos^0')
    print('^4  ^7' .. table.concat(active, ', ') .. '^0')
    print('^4========================================^0')
    print('^4[Dei]^0 dei_hud v' .. v .. ' - ^2Iniciado^0')
    print('')
end)
