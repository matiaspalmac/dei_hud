Postals = {
    { code = "100", x = -1038.0, y = -2737.0 },
    { code = "102", x = -994.0, y = -2500.0 },
    { code = "104", x = -1115.0, y = -2271.0 },
    { code = "108", x = -1272.0, y = -1953.0 },
    { code = "112", x = -1437.0, y = -1634.0 },
    { code = "120", x = -1660.0, y = -1118.0 },
    { code = "124", x = -1732.0, y = -767.0 },
    { code = "130", x = -1823.0, y = -429.0 },
    { code = "135", x = -1520.0, y = -265.0 },
    { code = "140", x = -1274.0, y = -347.0 },
    { code = "145", x = -1029.0, y = -489.0 },
    { code = "150", x = -890.0, y = -540.0 },
    { code = "155", x = -705.0, y = -615.0 },
    { code = "160", x = -532.0, y = -677.0 },
    { code = "165", x = -268.0, y = -741.0 },
    { code = "170", x = -45.0, y = -787.0 },
    { code = "175", x = 150.0, y = -895.0 },
    { code = "180", x = 240.0, y = -1080.0 },
    { code = "185", x = 380.0, y = -1250.0 },
    { code = "190", x = 430.0, y = -1510.0 },
    { code = "195", x = 335.0, y = -1770.0 },
    { code = "200", x = 280.0, y = -1960.0 },
    { code = "205", x = 145.0, y = -2200.0 },
    { code = "210", x = -130.0, y = -2450.0 },
    { code = "215", x = -395.0, y = -2190.0 },
    { code = "220", x = -580.0, y = -1910.0 },
    { code = "225", x = -660.0, y = -1620.0 },
    { code = "230", x = -578.0, y = -1390.0 },
    { code = "235", x = -418.0, y = -1150.0 },
    { code = "240", x = -235.0, y = -990.0 },
    { code = "245", x = -50.0, y = -1120.0 },
    { code = "250", x = 120.0, y = -1290.0 },
    { code = "300", x = -490.0, y = -340.0 },
    { code = "305", x = -330.0, y = -150.0 },
    { code = "310", x = -150.0, y = 20.0 },
    { code = "315", x = 100.0, y = -200.0 },
    { code = "320", x = 310.0, y = -400.0 },
    { code = "325", x = 470.0, y = -600.0 },
    { code = "330", x = 620.0, y = -800.0 },
    { code = "335", x = 810.0, y = -1050.0 },
    { code = "340", x = 950.0, y = -1290.0 },
    { code = "345", x = 1100.0, y = -1520.0 },
    { code = "350", x = 1220.0, y = -1760.0 },
    { code = "400", x = -1850.0, y = -1230.0 },
    { code = "405", x = -2050.0, y = -1060.0 },
    { code = "410", x = -2280.0, y = -900.0 },
    { code = "415", x = -2500.0, y = -650.0 },
    { code = "420", x = -2680.0, y = -400.0 },
    { code = "500", x = -500.0, y = 50.0 },
    { code = "505", x = -750.0, y = 250.0 },
}

function GetNearestPostal()
    if not Config.ShowPostal then return nil end
    local pos = GetEntityCoords(PlayerPedId())
    local nearest = nil
    local minDist = 999999.0
    for _, p in ipairs(Postals) do
        local dx = pos.x - p.x
        local dy = pos.y - p.y
        local dist = dx * dx + dy * dy -- squared distance for performance
        if dist < minDist then
            minDist = dist
            nearest = p.code
        end
    end
    return nearest
end
