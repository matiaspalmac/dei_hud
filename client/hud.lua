local show = true
local cinema = false
local editMode = false
local settingsOpen = false
local afk = false
local lastInput = GetGameTimer()
local speedMultiplier = Config.SpeedUnit == 'mph' and 2.236936 or 3.6
local speedUnit = Config.SpeedUnit == 'mph' and 'MPH' or 'KM/H'

local WEAPON_UNARMED = GetHashKey('WEAPON_UNARMED')
local myPlayerId = PlayerId()
local myServerId = GetPlayerServerId(myPlayerId)

local prev = {}
local function changed(key, val)
    if prev[key] ~= val then prev[key] = val return true end
    return false
end

-- KVP helpers
local function loadPrefs()
    local raw = GetResourceKvpString('dei_hud_prefs')
    if raw and raw ~= '' then return json.decode(raw) end
    return {}
end

local function savePrefs(prefs)
    SetResourceKvp('dei_hud_prefs', json.encode(prefs))
end

-- Cache pma-voice resource state
local hasPmaVoice = GetResourceState('pma-voice') == 'started'

-- Voice (pma-voice)
local function getVoiceRange()
    if not Config.ShowVoice then return 0, false end
    if hasPmaVoice then
        local ok, range = pcall(function() return exports['pma-voice']:getVoiceRange() end)
        if ok then return range or 0, MumbleIsPlayerTalking(myPlayerId) end
    end
    return 0, false
end

-- Radio channel
local function getRadioChannel()
    if not Config.ShowRadio then return 0 end
    if hasPmaVoice then
        local ok, channel = pcall(function() return exports['pma-voice']:getRadioChannel() end)
        if ok and channel and channel > 0 then return channel end
    end
    return 0
end

-- Compass
local function getStreetName()
    local pos = GetEntityCoords(PlayerPedId())
    local streetHash, crossHash = GetStreetNameAtCoord(pos.x, pos.y, pos.z)
    local street = GetStreetNameFromHashKey(streetHash)
    if crossHash ~= 0 then street = street .. ' / ' .. GetStreetNameFromHashKey(crossHash) end
    return street
end

local function getDirection()
    local camRot = GetGameplayCamRot(2)
    local heading = (360.0 - camRot.z) % 360.0
    local dirs = { 'N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE' }
    return dirs[math.floor(((heading + 22.5) % 360) / 45) + 1] or 'N'
end

-- Drug/alcohol effects
local function getDrugEffect()
    if not Config.ShowDrugEffects then return false, 0 end
    if Config.Framework == 'qb' then
        local pd = Framework and Framework.Functions and Framework.Functions.GetPlayerData()
        local meta = pd and pd.metadata
        local drunk = meta and meta['alcohol'] or 0
        local drugged = meta and meta['drug'] or 0
        return (drunk > 0 or drugged > 0), math.max(drunk, drugged)
    end
    return false, 0
end

-- Weapon info
local function getWeaponInfo()
    if not Config.ShowWeapon then return nil end
    local ped = PlayerPedId()
    local _, weaponHash = GetCurrentPedWeapon(ped, true)
    if weaponHash == WEAPON_UNARMED then return nil end
    local ammoInClip = 0
    local _, clip = GetAmmoInClip(ped, weaponHash)
    ammoInClip = clip
    local totalAmmo = GetAmmoInPedWeapon(ped, weaponHash)
    local reserve = totalAmmo - ammoInClip
    return { clip = ammoInClip, reserve = reserve, total = totalAmmo }
end

-- Money tracking
local prevCash, prevBank = -1, -1

-- Effects system
local activeEffects = {}
local effectCounter = 0

-- Progress bar state
local progressActive = false
local progressCallback = nil

-- Circular progress state
local circularProgressActive = false
local circularProgressCallback = nil

-- Exports
function toggleHud(state)
    if state ~= nil then show = state else show = not show end
    if not show then
        SendNUIMessage({ action = 'hideHud' })
    else
        -- Force immediate update by resetting change detection
        for k in pairs(prev) do prev[k] = nil end
        SendNUIMessage({ action = 'forceShow' })
    end
end

function isHudVisible() return show and not cinema and not afk end

function showNotification(msg, type)
    Notify(msg, type)
end

function ProgressBar(duration, label, color)
    if progressActive then return false end
    progressActive = true
    SendNUIMessage({
        action = 'progressBar',
        duration = duration,
        label = label or '',
        color = color or nil,
    })
    local p = promise.new()
    progressCallback = p
    local result = Citizen.Await(p)
    progressActive = false
    progressCallback = nil
    return result
end

function CancelProgress()
    if not progressActive and not circularProgressActive then return end
    if progressActive then
        SendNUIMessage({ action = 'cancelProgress' })
        progressActive = false
        if progressCallback then
            progressCallback:resolve(false)
            progressCallback = nil
        end
    end
    if circularProgressActive then
        SendNUIMessage({ action = 'cancelCircularProgress' })
        circularProgressActive = false
        if circularProgressCallback then
            circularProgressCallback:resolve(false)
            circularProgressCallback = nil
        end
    end
end

function CircularProgress(duration, label, icon, color)
    if circularProgressActive or progressActive then return false end
    circularProgressActive = true
    SendNUIMessage({
        action = 'circularProgress',
        duration = duration,
        label = label or '',
        icon = icon or 'timer',
        color = color or nil,
    })
    local p = promise.new()
    circularProgressCallback = p
    local result = Citizen.Await(p)
    circularProgressActive = false
    circularProgressCallback = nil
    return result
end

function AddEffect(id, label, icon, duration, color)
    if not id then return end
    -- Remove existing with same id
    for i, e in ipairs(activeEffects) do
        if e.id == id then
            table.remove(activeEffects, i)
            break
        end
    end
    -- Max 5
    if #activeEffects >= 5 then
        table.remove(activeEffects, 1)
    end
    effectCounter = effectCounter + 1
    local effect = {
        id = id,
        label = label or id,
        icon = icon or 'star',
        duration = duration or 30000,
        color = color or '#3b82f6',
        startTime = GetGameTimer(),
        uid = effectCounter,
    }
    table.insert(activeEffects, effect)
    sendEffectsToNUI()
end

function RemoveEffect(id)
    for i, e in ipairs(activeEffects) do
        if e.id == id then
            table.remove(activeEffects, i)
            sendEffectsToNUI()
            return
        end
    end
end

function sendEffectsToNUI()
    local now = GetGameTimer()
    local data = {}
    for _, e in ipairs(activeEffects) do
        local elapsed = now - e.startTime
        local remaining = math.max(0, e.duration - elapsed)
        table.insert(data, {
            id = e.id,
            label = e.label,
            icon = e.icon,
            duration = e.duration,
            remaining = remaining,
            color = e.color,
            uid = e.uid,
        })
    end
    SendNUIMessage({ action = 'updateEffects', effects = data })
end

-- Effects countdown thread
CreateThread(function()
    while true do
        Wait(500)
        if #activeEffects > 0 then
            local now = GetGameTimer()
            local changed = false
            for i = #activeEffects, 1, -1 do
                local e = activeEffects[i]
                if (now - e.startTime) >= e.duration then
                    table.remove(activeEffects, i)
                    changed = true
                end
            end
            sendEffectsToNUI()
        end
    end
end)

-- NUI Callbacks
RegisterNUICallback('progressComplete', function(_, cb)
    if progressCallback then
        progressCallback:resolve(true)
        progressCallback = nil
    end
    progressActive = false
    cb({ ok = true })
end)

RegisterNUICallback('circularProgressComplete', function(_, cb)
    if circularProgressCallback then
        circularProgressCallback:resolve(true)
        circularProgressCallback = nil
    end
    circularProgressActive = false
    cb({ ok = true })
end)

RegisterNUICallback('savePositions', function(data, cb)
    local prefs = loadPrefs()
    prefs.positions = data.positions
    savePrefs(prefs)
    editMode = false
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

RegisterNUICallback('closeEditMode', function(_, cb)
    editMode = false
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

RegisterNUICallback('saveSettings', function(data, cb)
    local prefs = loadPrefs()
    -- Apply settings
    if data.theme then
        prefs.theme = data.theme
        SendNUIMessage({ action = 'setTheme', theme = data.theme })
    end
    if data.lightMode ~= nil then
        prefs.lightMode = data.lightMode
        if data.lightMode then
            SendNUIMessage({ action = 'setLightMode', enabled = true })
        else
            SendNUIMessage({ action = 'setLightMode', enabled = false })
        end
    end
    if data.scale then
        prefs.scale = data.scale
        SendNUIMessage({ action = 'setScale', scale = data.scale })
    end
    if data.speedUnit then
        prefs.speedUnit = data.speedUnit
        if data.speedUnit == 'mph' then
            speedMultiplier = 2.236936
            speedUnit = 'MPH'
        else
            speedMultiplier = 3.6
            speedUnit = 'KM/H'
        end
        Config.SpeedUnit = data.speedUnit
    end
    if data.showVoice ~= nil then
        prefs.showVoice = data.showVoice
        Config.ShowVoice = data.showVoice
    end
    if data.showRadio ~= nil then
        prefs.showRadio = data.showRadio
        Config.ShowRadio = data.showRadio
    end
    if data.showWeapon ~= nil then
        prefs.showWeapon = data.showWeapon
        Config.ShowWeapon = data.showWeapon
    end
    if data.showStress ~= nil then
        prefs.showStress = data.showStress
        Config.ShowStress = data.showStress
    end
    if data.hideWhenFull ~= nil then
        prefs.hideWhenFull = data.hideWhenFull
        Config.HideWhenFull = data.hideWhenFull
    end
    savePrefs(prefs)
    -- Ecosystem sync
    TriggerEvent('dei:themeChanged', prefs.theme or Config.Theme, prefs.lightMode or false)
    cb({ ok = true })
end)

RegisterNUICallback('closeSettings', function(_, cb)
    settingsOpen = false
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

-- Send saved prefs + theme on startup
CreateThread(function()
    Wait(1000)
    SendNUIMessage({ action = 'setTheme', theme = Config.Theme })
    local prefs = loadPrefs()
    if next(prefs) then
        SendNUIMessage({ action = 'loadPrefs', prefs = prefs })
        -- Apply saved prefs to config
        if prefs.speedUnit then
            Config.SpeedUnit = prefs.speedUnit
            if prefs.speedUnit == 'mph' then
                speedMultiplier = 2.236936
                speedUnit = 'MPH'
            else
                speedMultiplier = 3.6
                speedUnit = 'KM/H'
            end
        end
        if prefs.showVoice ~= nil then Config.ShowVoice = prefs.showVoice end
        if prefs.showRadio ~= nil then Config.ShowRadio = prefs.showRadio end
        if prefs.showWeapon ~= nil then Config.ShowWeapon = prefs.showWeapon end
        if prefs.showStress ~= nil then Config.ShowStress = prefs.showStress end
        if prefs.hideWhenFull ~= nil then Config.HideWhenFull = prefs.hideWhenFull end
    end
end)

-- AFK detection
CreateThread(function()
    if not Config.AfkEnabled then return end
    while true do
        Wait(1000)
        -- Detect any input
        local controls = { 1, 2, 24, 25, 34, 35, 71, 72 } -- mouse, aim, shoot, move, accelerate, brake
        local hasInput = false
        for _, c in ipairs(controls) do
            if IsControlPressed(0, c) or IsDisabledControlPressed(0, c) then
                hasInput = true
                break
            end
        end

        if hasInput then
            if afk then
                afk = false
                SendNUIMessage({ action = 'afkStatus', afk = false })
            end
            lastInput = GetGameTimer()
        else
            local elapsed = (GetGameTimer() - lastInput) / 1000
            if not afk and elapsed >= Config.AfkTimeout then
                afk = true
                SendNUIMessage({ action = 'afkStatus', afk = true })
            end
        end
    end
end)

-- Main vitals loop
CreateThread(function()
    while true do
        Wait(Config.UpdateInterval)
        if show and not cinema and not afk and not editMode and not IsPauseMenuActive() then
            local ped = PlayerPedId()
            if DoesEntityExist(ped) then
                local health = math.max(0, math.floor(GetEntityHealth(ped) - 100))
                local armor = GetPedArmour(ped)
                local stamina = math.floor(100 - GetPlayerSprintStaminaRemaining(myPlayerId))
                local thirst, hunger = GetThirstHunger()
                local job = GetJobLabel()
                local pid = myServerId
                local stressVal = GetStress()
                local voiceRange, talking = getVoiceRange()
                local radio = getRadioChannel()
                local drugged, drugLevel = getDrugEffect()
                local weapon = getWeaponInfo()

                local oxygen = 100
                local underWater = IsPedSwimmingUnderWater(ped)
                if Config.ShowOxygen and underWater then
                    oxygen = math.floor(GetPlayerUnderwaterTimeRemaining(myPlayerId) * 10)
                end

                local c = changed('health', health) or changed('armor', armor)
                    or changed('stamina', stamina) or changed('thirst', thirst)
                    or changed('hunger', hunger) or changed('job', job)
                    or changed('pid', pid) or changed('stress', stressVal)
                    or changed('voice', voiceRange) or changed('talking', talking)
                    or changed('oxygen', oxygen) or changed('radio', radio)
                    or changed('drugged', drugged)
                    or changed('weaponClip', weapon and weapon.clip or -1)
                    or changed('weaponReserve', weapon and weapon.reserve or -1)

                if c then
                    SendNUIMessage({
                        action = 'showHud',
                        health = health, armor = armor, stamina = stamina,
                        thirst = thirst, hunger = hunger, job = job,
                        playerid = pid, stress = stressVal, oxygen = oxygen,
                        voiceRange = voiceRange, talking = talking,
                        radio = radio,
                        drugged = drugged, drugLevel = drugLevel,
                        weapon = weapon,
                        showStaminaVignette = Config.ShowStaminaVignette,
                        map = Config.UseMap,
                        hideWhenFull = Config.HideWhenFull,
                        hideThreshold = Config.HideThreshold,
                        showStress = Config.ShowStress,
                        showOxygen = Config.ShowOxygen and underWater,
                        showVoice = Config.ShowVoice,
                        showRadio = Config.ShowRadio,
                        showWeapon = Config.ShowWeapon,
                        showPlayerID = Config.ShowPlayerID,
                        staggerDelay = Config.StaggerDelay,
                        -- Critical/warning thresholds
                        criticalHealth = Config.CriticalHealth,
                        warningHunger = Config.WarningHunger,
                        warningThirst = Config.WarningThirst,
                        stressEffects = Config.StressEffects,
                        underWater = underWater,
                    })
                end
                if Config.UseMap then DisplayRadar(true) end
            end
        elseif not show or cinema or afk or IsPauseMenuActive() then
            SendNUIMessage({ action = 'hideHud' })
        end
    end
end)

-- Money tracking loop
CreateThread(function()
    Wait(2000) -- wait for framework init
    if not Config.ShowMoney then return end
    while true do
        Wait(Config.UpdateInterval)
        if show and not cinema and not afk and not IsPauseMenuActive() and Framework then
            local cash, bank = GetMoney()
            local cashDiff = 0
            local bankDiff = 0
            if prevCash >= 0 then cashDiff = cash - prevCash end
            if prevBank >= 0 then bankDiff = bank - prevBank end
            local moneyChanged = changed('cash', cash) or changed('bank', bank)
            if moneyChanged then
                SendNUIMessage({
                    action = 'updateMoney',
                    cash = cash,
                    bank = bank,
                    cashDiff = cashDiff,
                    bankDiff = bankDiff,
                })
            end
            prevCash = cash
            prevBank = bank
        end
    end
end)

-- Vehicle detection
CreateThread(function()
    while true do
        Wait(1000)
        local wasInVeh = InVeh
        InVeh = IsPedInAnyVehicle(PlayerPedId(), false)
        if InVeh ~= wasInVeh then
            if InVeh then
                SendNUIMessage({
                    action = 'showSpeed', map = Config.OnVehicleMap, unit = speedUnit,
                    showFuel = Config.ShowFuel, showGear = Config.ShowGear,
                    showCompass = Config.ShowCompass, showDamage = Config.ShowVehicleDamage,
                    showSignals = Config.ShowSignals, showNos = Config.ShowNos,
                    seatbelt = SeatBelt, harnessEnabled = Config.HarnessEnabled,
                    harness = Harness,
                })
                if Config.OnVehicleMap then DisplayRadar(true) end
            else
                SendNUIMessage({ action = 'hideSpeed' })
                if not Config.UseMap then DisplayRadar(false) end
                Cruise = false; CruiseSpeed = 0; SeatBelt = false; Harness = false
                LeftSignal = false; RightSignal = false; HazardLights = false
                SendNUIMessage({ action = 'seatbelt', active = false })
                SendNUIMessage({ action = 'harness', active = false })
                SendNUIMessage({ action = 'signals', left = false, right = false, hazard = false })
            end
        end
    end
end)

-- Vehicle status
CreateThread(function()
    while true do
        Wait(Config.VehicleInterval)
        if InVeh and show and not cinema and not afk then
            local ped = PlayerPedId()
            local vehicle = GetVehiclePedIsIn(ped, false)
            if vehicle ~= 0 then
                local engine = GetIsVehicleEngineRunning(vehicle)
                local _, lightsOn, highBeams = GetVehicleLightsState(vehicle)
                local engineDmg, bodyDmg = GetVehicleDamage(vehicle)
                local nos = Config.ShowNos and HasNos(vehicle) or false
                local locked = GetVehicleDoorLockStatus(vehicle) >= 2
                local vLights = lightsOn == 1 or highBeams == 1
                local vRpm = math.floor(GetVehicleCurrentRpm(vehicle) * 100)
                local vSpeed = math.floor(GetEntitySpeed(vehicle) * speedMultiplier)
                local vFuel = math.floor(GetVehicleFuelLevel(vehicle))
                local vGear = GetVehicleCurrentGear(vehicle)
                local vStreet = Config.ShowCompass and getStreetName() or ''
                local vDir = Config.ShowCompass and getDirection() or ''

                local vc = changed('vEngine', engine) or changed('vLights', vLights)
                    or changed('vRpm', vRpm) or changed('vSpeed', vSpeed)
                    or changed('vFuel', vFuel) or changed('vGear', vGear)
                    or changed('vStreet', vStreet) or changed('vDir', vDir)
                    or changed('vSeatbelt', SeatBelt) or changed('vHarness', Harness)
                    or changed('vCruise', Cruise) or changed('vCruiseSpeed', CruiseSpeed)
                    or changed('vEngineDmg', engineDmg) or changed('vBodyDmg', bodyDmg)
                    or changed('vNos', nos) or changed('vLocked', locked)

                if vc then
                    SendNUIMessage({
                        action = 'vehicleStatus',
                        engine = engine,
                        lights = vLights,
                        rpm = vRpm,
                        speed = vSpeed,
                        fuel = vFuel,
                        gear = vGear,
                        street = vStreet,
                        direction = vDir,
                        seatbelt = SeatBelt,
                        harness = Harness,
                        cruise = Cruise, cruiseSpeed = CruiseSpeed,
                        engineDamage = engineDmg, bodyDamage = bodyDmg,
                        nos = nos, locked = locked,
                    })
                end
            end
        end
    end
end)

-- Cinema mode
RegisterKeyMapping('CinemaMode', 'Modo cine', 'keyboard', Config.CinemaMode)
RegisterCommand('CinemaMode', function()
    cinema = not cinema
    if cinema then
        SendNUIMessage({ action = 'hideHud' })
        DisplayRadar(false)
        DisplayHud(false)
        Notify('Modo cine activado', 'info')
    else
        DisplayHud(true)
        if Config.UseMap or (Config.OnVehicleMap and InVeh) then DisplayRadar(true) end
        Notify('Modo cine desactivado', 'info')
    end
end, false)

-- Settings panel
RegisterKeyMapping('OpenSettings', 'Abrir ajustes HUD', 'keyboard', Config.SettingsKey)
RegisterCommand('OpenSettings', function()
    if editMode then return end
    settingsOpen = not settingsOpen
    if settingsOpen then
        SetNuiFocus(true, true)
        local prefs = loadPrefs()
        SendNUIMessage({
            action = 'openSettings',
            prefs = prefs,
            config = {
                theme = prefs.theme or Config.Theme,
                lightMode = prefs.lightMode or false,
                scale = prefs.scale or 1.0,
                speedUnit = prefs.speedUnit or Config.SpeedUnit,
                showVoice = Config.ShowVoice,
                showRadio = Config.ShowRadio,
                showWeapon = Config.ShowWeapon,
                showStress = Config.ShowStress,
                hideWhenFull = Config.HideWhenFull,
            },
        })
    else
        SetNuiFocus(false, false)
        SendNUIMessage({ action = 'closeSettingsPanel' })
    end
end, false)

-- HUD toggle
RegisterCommand('hud', function()
    toggleHud()
    Notify(show and 'HUD activado' or 'HUD desactivado')
end, false)

-- Theme command
RegisterCommand('hudtheme', function(_, args)
    local themes = { dark = true, midnight = true, neon = true, minimal = true }
    local theme = args[1]
    if not theme or not themes[theme] then
        Notify('Uso: /hudtheme [dark|midnight|neon|minimal]', 'error')
        return
    end
    SendNUIMessage({ action = 'setTheme', theme = theme })
    local prefs = loadPrefs()
    prefs.theme = theme
    savePrefs(prefs)
    -- Sync ecosystem
    TriggerEvent('dei:themeChanged', theme, prefs.lightMode or false)
    Notify('Tema: ' .. theme, 'info')
end, false)

-- Color toggle
RegisterCommand('togglecolor', function()
    SendNUIMessage({ action = 'toggleColor' })
    local prefs = loadPrefs()
    prefs.lightMode = not prefs.lightMode
    savePrefs(prefs)
    -- Sync ecosystem
    TriggerEvent('dei:themeChanged', prefs.theme or 'dark', prefs.lightMode)
end, false)

-- HUD move mode
RegisterCommand('hudmove', function()
    editMode = not editMode
    SetNuiFocus(editMode, editMode)
    SendNUIMessage({ action = 'editMode', active = editMode })
    if editMode then
        Notify('Arrastra los paneles. Escribe /hudmove de nuevo para guardar.', 'info')
    end
end, false)

-- HUD scale
RegisterCommand('hudscale', function(_, args)
    local scale = tonumber(args[1])
    if not scale or scale < 0.5 or scale > 2.0 then
        Notify('Uso: /hudscale [0.5 - 2.0]', 'error')
        return
    end
    SendNUIMessage({ action = 'setScale', scale = scale })
    local prefs = loadPrefs()
    prefs.scale = scale
    savePrefs(prefs)
    Notify('Escala: ' .. scale, 'info')
end, false)

-- Compass bar data loop (fast, heading-based)
local cachedPostal = nil
local lastPostalCalc = 0
CreateThread(function()
    while true do
        Wait(100) -- ~10fps for smooth compass
        if Config.ShowCompassBar and show and not cinema and not afk and not IsPauseMenuActive() then
            local ped = PlayerPedId()
            if DoesEntityExist(ped) then
                local camRot = GetGameplayCamRot(2)
                local heading = (360.0 - camRot.z) % 360.0
                local street = getStreetName()
                local pos = GetEntityCoords(ped)
                local zoneName = GetNameOfZone(pos.x, pos.y, pos.z)
                local zoneLabel = GetLabelText(zoneName)

                -- Cache postal, recalculate every 500ms
                local now = GetGameTimer()
                if now - lastPostalCalc > 500 then
                    cachedPostal = GetNearestPostal()
                    lastPostalCalc = now
                end
                local postal = cachedPostal

                -- Waypoint direction
                local wpHeading = -1
                if IsWaypointActive() then
                    local wpCoord = GetBlipInfoIdCoord(GetFirstBlipInfoId(8))
                    local dx = wpCoord.x - pos.x
                    local dy = wpCoord.y - pos.y
                    wpHeading = math.deg(math.atan(dx, dy))
                    if wpHeading < 0 then wpHeading = wpHeading + 360 end
                end

                SendNUIMessage({
                    action = 'updateCompass',
                    heading = heading,
                    street = street,
                    zone = zoneLabel ~= 'YOURNAME' and zoneLabel or zoneName,
                    postal = postal,
                    waypoint = wpHeading,
                })
            end
        end
    end
end)

-- ============================================================
-- Dei Ecosystem - Startup
-- ============================================================
-- Cleanup on resource stop
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    DisplayHud(true)
end)

