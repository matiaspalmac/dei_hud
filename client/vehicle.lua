InVeh = false
Cruise = false
CruiseSpeed = 0
SeatBelt = false
Harness = false
LeftSignal = false
RightSignal = false
HazardLights = false

-- Engine toggle
RegisterKeyMapping('TurnEngine', 'Encender/apagar motor', 'keyboard', Config.TurnEngine)
RegisterCommand('TurnEngine', function()
    if not InVeh then return end
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    local running = GetIsVehicleEngineRunning(vehicle)
    SetVehicleEngineOn(vehicle, not running, false, true)
    Notify(running and 'Motor apagado' or 'Motor encendido')
end, false)

-- Cruise control
RegisterKeyMapping('CruiseControl', 'Control de crucero', 'keyboard', Config.CruiseControl)
RegisterCommand('CruiseControl', function()
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if not InVeh or GetPedInVehicleSeat(vehicle, -1) ~= ped then return end
    Cruise = not Cruise
    if Cruise then
        local speed = GetEntitySpeed(vehicle)
        SetVehicleMaxSpeed(vehicle, speed)
        CruiseSpeed = math.floor(speed * (Config.SpeedUnit == 'mph' and 2.236936 or 3.6))
    else
        SetVehicleMaxSpeed(vehicle, 0.0)
        CruiseSpeed = 0
    end
    SendNUIMessage({ action = 'cruiseControl', cruise = Cruise, cruiseSpeed = CruiseSpeed })
end, false)

-- Seatbelt
RegisterKeyMapping('SeatBelt', 'Cinturon de seguridad', 'keyboard', Config.SeatBelt)
RegisterCommand('SeatBelt', function()
    if not InVeh then return end
    SeatBelt = not SeatBelt
    SendNUIMessage({ action = 'seatbelt', active = SeatBelt })
    Notify(SeatBelt and 'Cinturon abrochado' or 'Cinturon desabrochado')
    SetPedCanBeKnockedOffVehicle(PlayerPedId(), SeatBelt and 1 or 0)
end, false)

-- Harness
if Config.HarnessEnabled then
    RegisterKeyMapping('ToggleHarness', 'Arnes de seguridad', 'keyboard', Config.HarnessKey)
    RegisterCommand('ToggleHarness', function()
        if not InVeh then return end
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        local class = GetVehicleClass(vehicle)
        -- Classes: 5=Sports, 6=Super, 7=Motorcycle, 8=Cycle, 9=Off-road, 22=OpenWheel
        if class == 5 or class == 6 or class == 9 or class == 22 then
            Harness = not Harness
            SendNUIMessage({ action = 'harness', active = Harness })
            Notify(Harness and 'Arnes abrochado' or 'Arnes desabrochado')
            SetPedCanBeKnockedOffVehicle(PlayerPedId(), (SeatBelt or Harness) and 1 or 0)
        else
            Notify('Este vehiculo no tiene arnes', 'error')
        end
    end, false)
end

-- Turn signals
RegisterKeyMapping('LeftSignal', 'Senalero izquierdo', 'keyboard', Config.LeftSignal)
RegisterCommand('LeftSignal', function()
    if not InVeh then return end
    HazardLights = false
    LeftSignal = not LeftSignal
    if LeftSignal then RightSignal = false end
    SendNUIMessage({ action = 'signals', left = LeftSignal, right = RightSignal, hazard = false })
end, false)

RegisterKeyMapping('RightSignal', 'Senalero derecho', 'keyboard', Config.RightSignal)
RegisterCommand('RightSignal', function()
    if not InVeh then return end
    HazardLights = false
    RightSignal = not RightSignal
    if RightSignal then LeftSignal = false end
    SendNUIMessage({ action = 'signals', left = LeftSignal, right = RightSignal, hazard = false })
end, false)

RegisterKeyMapping('HazardLights', 'Balizas', 'keyboard', Config.HazardLights)
RegisterCommand('HazardLights', function()
    if not InVeh then return end
    HazardLights = not HazardLights
    LeftSignal = false
    RightSignal = false
    SendNUIMessage({ action = 'signals', left = false, right = false, hazard = HazardLights })
end, false)

-- Signal blink loop
CreateThread(function()
    while true do
        Wait(500)
        if InVeh and (LeftSignal or RightSignal or HazardLights) then
            local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
            if vehicle ~= 0 then
                if LeftSignal or HazardLights then
                    SetVehicleIndicatorLights(vehicle, 1, true)
                    Wait(500)
                    SetVehicleIndicatorLights(vehicle, 1, false)
                end
                if RightSignal or HazardLights then
                    SetVehicleIndicatorLights(vehicle, 0, true)
                    Wait(500)
                    SetVehicleIndicatorLights(vehicle, 0, false)
                end
            end
        end
    end
end)

-- Seatbelt crash detection
local prevSpeed = 0
CreateThread(function()
    if not Config.SeatBeltEnabled then return end
    while true do
        Wait(100)
        if InVeh then
            local ped = PlayerPedId()
            local vehicle = GetVehiclePedIsIn(ped, false)
            local speed = math.floor(GetEntitySpeed(vehicle) * 3.6)
            local diff = prevSpeed - speed

            if not SeatBelt and not Harness and diff > 30 then
                local damage = math.floor(Config.CrashDamage * (diff / 30))
                SetEntityHealth(ped, GetEntityHealth(ped) - damage)
                SendNUIMessage({ action = 'crash' })

                if prevSpeed >= Config.EjectSpeed then
                    SetPedToRagdoll(ped, 5000, 5000, 0, true, true, false)
                    local vx, vy, vz = table.unpack(GetEntityVelocity(vehicle))
                    SetEntityVelocity(ped, vx * 1.5, vy * 1.5, vz + 10.0)
                    TaskLeaveVehicle(ped, vehicle, 4160)
                    Wait(100)
                    SetPedToRagdoll(ped, 5000, 5000, 0, true, true, false)
                end
                Notify('No llevabas cinturon!', 'error')
            end
            prevSpeed = speed
        else
            prevSpeed = 0
        end
    end
end)

-- Vehicle damage helper
function GetVehicleDamage(vehicle)
    local engineHealth = math.max(0, math.floor(GetVehicleEngineHealth(vehicle) / 10))
    local bodyHealth = math.max(0, math.floor(GetVehicleBodyHealth(vehicle) / 10))
    return engineHealth, bodyHealth
end

-- NOS detection
function HasNos(vehicle)
    return IsToggleModOn(vehicle, 18)
end
