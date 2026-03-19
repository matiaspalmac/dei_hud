Framework = nil

CreateThread(function()
    if Config.Framework == 'esx' then
        Framework = exports['es_extended']:getSharedObject()
    elseif Config.Framework == 'qb' then
        Framework = exports['qb-core']:GetCoreObject()
    end
end)

function GetThirstHunger()
    if not Framework then return 0, 0 end
    local thirst, hunger = 0, 0
    if Config.Framework == 'esx' then
        TriggerEvent('esx_status:getStatus', 'thirst', function(s) thirst = math.floor(s.getPercent()) end)
        TriggerEvent('esx_status:getStatus', 'hunger', function(s) hunger = math.floor(s.getPercent()) end)
    elseif Config.Framework == 'qb' then
        local pd = Framework and Framework.Functions and Framework.Functions.GetPlayerData()
        local meta = pd and pd.metadata
        if meta then
            thirst = math.floor(meta['thirst'] or 0)
            hunger = math.floor(meta['hunger'] or 0)
        end
    end
    return thirst, hunger
end

function GetStress()
    if not Config.ShowStress then return 0 end
    if not Framework then return 0 end
    if Config.Framework == 'qb' then
        local pd = Framework and Framework.Functions and Framework.Functions.GetPlayerData()
        local meta = pd and pd.metadata
        if not meta then return 0 end
        return math.floor(meta['stress'] or 0)
    end
    return 0
end

function GetJobLabel()
    if not Config.ShowJob then return nil end
    if not Framework then return nil end
    if Config.Framework == 'esx' then
        local pd = Framework and Framework.PlayerData
        if not pd then return nil end
        return pd.job and pd.job.label or 'Desempleado'
    elseif Config.Framework == 'qb' then
        local pd = Framework and Framework.Functions and Framework.Functions.GetPlayerData()
        if not pd then return nil end
        return pd.job and pd.job.label or 'Desempleado'
    end
    return nil
end

function GetMoney()
    if not Framework then return 0, 0 end
    local cash, bank = 0, 0
    if Config.Framework == 'esx' then
        local pd = Framework.PlayerData
        if pd and pd.accounts then
            for _, acc in ipairs(pd.accounts) do
                if acc.name == 'money' then cash = math.floor(acc.money) end
                if acc.name == 'bank' then bank = math.floor(acc.money) end
            end
        end
    elseif Config.Framework == 'qb' then
        local pd = Framework.Functions.GetPlayerData()
        if pd and pd.money then
            cash = math.floor(pd.money['cash'] or 0)
            bank = math.floor(pd.money['bank'] or 0)
        end
    end
    return cash, bank
end

function Notify(msg, type)
    -- Prefer dei_notifys if running (ecosystem)
    if GetResourceState('dei_notifys') == 'started' then
        exports['dei_notifys']:Notify(msg, type or 'info')
        return
    end
    if Config.UseCustomNotifs then
        SendNUIMessage({ action = 'notification', message = msg, type = type or 'info', duration = Config.NotifDuration })
        return
    end
    if Config.Framework == 'esx' and Framework then
        Framework.ShowNotification(msg)
    elseif Config.Framework == 'qb' and Framework then
        Framework.Functions.Notify(msg, type)
    end
end
