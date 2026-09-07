// Generated from audited PowerPoint text layers. Do not edit by hand.
export const librarySlideContent = {
  "Afstandssensor.pptx": {
    "4": {
      "title": "Sådan bruges Afstands-sensoren",
      "text": "import distance_sensor # Fortæl programmet af vi bruger afstandsmålere\n\ndistance_sensor.distance(port.A) # mål afstand i millimeter"
    },
    "5": {
      "title": "Eksempel for måling",
      "text": "import runloop # fortæl programmet af vi bruger Main evighedsløkken\nimport distance_sensor # Fortæl programmet af vi bruger afstandsmåleren\nfrom hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\n\nasync def main(): # main\n    distance = distance_sensor.distance(port.A) # mål afstand i millimeter\n    print(distance) # print målt afstand i milimeter\n\nrunloop.run(main()) # start main "
    },
    "6": {
      "title": "Sådan bruges Afstands-sensoren",
      "text": "from mindstorms import DistanceSensor # fortæl programmet at vi bruger afstandsmåleren\n\n# Opret en variable der kan holde værdien af den målte afstand\n# og mål afstand fra port A\nafstand = DistanceSensor('A').get_distance_cm()"
    },
    "7": {
      "title": "Eksempel for måling",
      "text": "from mindstorms import DistanceSensor # fortæl programmet at vi bruger afstandsmåleren\n\n# Opret en variable der kan holde værdien af den målte afstand\n# og mål afstand fra port A\nafstand = DistanceSensor('A').get_distance_cm()\n\nprint(\"cm: \", afstand) # print den målte farve"
    },
    "9": {
      "title": "Sådan bruges Lygte-Styring på Afstands-sensoren",
      "text": "import distance_sensor # Fortæl programmet at vi bruger afstandsmåleren\n\ndistance_sensor.set_pixel(port.A, 1, 0, 100) # sæt øverste venstre led til 100%\ndistance_sensor.set_pixel(port.A, 0, 0, 100) # sæt øverste højre led til 100%\ndistance_sensor.set_pixel(port.A, 1, 1, 100) # sæt nederste venstre led til 100%\ndistance_sensor.set_pixel(port.A, 0, 1, 100) # sæt nederste højre led til 100%"
    },
    "10": {
      "title": "Eksempel for Lygte-Styring på Afstands-sensoren",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger main\nimport distance_sensor # Fortæl programmet af vi bruger afstandsmåleren\n\nasync def main(): # main\n    distance_sensor.set_pixel(port.A, 1, 0, 100) # sæt øverste venstre led til 100%\n    distance_sensor.set_pixel(port.A, 0, 0, 100) # sæt øverste højre led til 100%\n    distance_sensor.set_pixel(port.A, 1, 1, 100) # sæt nederste venstre led til 100%\n    distance_sensor.set_pixel(port.A, 0, 1, 100) # sæt nederste højre led til 100%\n\nrunloop.run(main()) # start main"
    },
    "11": {
      "title": "Sådan bruges Lygte-Styring på Afstands-sensoren",
      "text": "from mindstorms import DistanceSensor # fortæl programmet at vi bruger afstandsmåleren\n\nDistanceSensor('A').light_up(100, 100, 100, 100) # sæt alle LEDer til 100% lysstyrke"
    },
    "12": {
      "title": "Eksempel for Lygte-Styring på Afstands-sensoren",
      "text": "from mindstorms import DistanceSensor # fortæl programmet at vi bruger afstandsmåleren\n\nDistanceSensor('A').light_up(100, 100, 100, 100) # sæt alle LEDer til 100% lysstyrke\n\nprint(\"Alle LEDer på afstandsmåleren er tændt!\")"
    }
  },
  "Asynkrone Tråde.pptx": {
    "3": {
      "title": "Sådan bruges asynkrone tråde",
      "text": "import runloop # fortæl programmet at vi bruger runloop\n\nasync def Main1():\n    while True: # for evigt\n        print(\"Tråd 1\") # besked så vi kan se hvor ofte tråd 1 kører\n        await runloop.sleep_ms(500) # vent 500 ms\n\nasync def Main2():\n    while True: # for evigt\n        print(\"Tråd 2\") # besked så vi kan se hvor ofte tråd 2 kører\n        await runloop.sleep_ms(2000) # vent 2000 ms\n\nrunloop.run(Main1(), Main2()) # start TO runloop processer"
    },
    "4": {
      "title": "Eksempel for asynkrone tråde",
      "text": "from hub import sound # fortæl programmet af vi bruger lyd\nfrom hub import light_matrix # fortæl programmet at vi bruger lys matricen\nimport runloop # fortæl programmet at vi bruger runloop\n\nasync def Sound():\n    sound.volume(100) # sæt lydstyrken til 100%\n    while True: # for evigt\n        await sound.beep(588, 250, 100) # 588 Mhz, 250 ms og 100% lydstyrke\n        await sound.beep(932, 250, 100) # 588 Mhz, 250 ms og 100% lydstyrke\n\nasync def LightMatrix():\n    while True: # for evigt\n        light_matrix.show_image(light_matrix.IMAGE_HAPPY) # vis glad emoji på lys matricen\n        await runloop.sleep_ms(1000) # vent 1000 ms\n        light_matrix.show_image(light_matrix.IMAGE_ANGRY) # vis sur emoji på lys matricen\n        await runloop.sleep_ms(1000) # vent 1000 ms\n\nrunloop.run(Sound(), LightMatrix()) # start TO runloop processer"
    }
  },
  "Farvesensor.pptx": {
    "4": {
      "title": "Sådan bruges Farve-sensoren",
      "text": "import color_sensor # Fortæl programmet af vi bruger farvesensoren\n\ncolor_sensor.color(port.A) # mål farve"
    },
    "5": {
      "title": "Eksempel for måling",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger Main evighedsløkken\nimport color_sensor # Fortæl programmet af vi bruger farvesensoren\n\nasync def main(): # main\n    color = color_sensor.color(port.A) # mål farve\n    print(color) # print målt farve\n\nrunloop.run(main()) # start main"
    },
    "6": {
      "title": "Sådan bruges Farve-sensoren",
      "text": "from mindstorms import ColorSensor # Fortæl programmet at vi bruger farvesensoren\n\n# Opret en variable der kan holde værdien af den målte farve\n# og mål farve fra port A\ncolor = ColorSensor('A').get_color()"
    },
    "7": {
      "title": "Eksempel for måling",
      "text": "from mindstorms import ColorSensor # Fortæl programmet at vi bruger farvesensoren\n\n# Opret en variable der kan holde værdien af den målte farve\n# og mål farve fra port A\ncolor = ColorSensor('A').get_color()\n\nprint(\"Den målte farve er: \" + color) # print den målte farve"
    }
  },
  "Gentag.pptx": {
    "4": {
      "title": "Sådan gentages kode 10 gange",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    for i in range(10): # gentag 10 gange\n        print(\"Denne linje bliver kørt og printet 10 gange\")\n\nrunloop.run(main()) # start main"
    },
    "5": {
      "title": "Sådan gentages kode 10 gange",
      "text": "for i in range(10): # gentag 10 gange\n    print(\"Denne linje bliver kørt og printet 10 gange\")"
    },
    "7": {
      "title": "Sådan gentages kode indtil et kriterie er nået",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    nuværendeTal = 0\n    slutTal = 10\n\n    while nuværendeTal < slutTal: # gentag lige så længe nuværendetal er mindre en slutTal\n        nuværendeTal = nuværendeTal + 1\n        print(\"Denne linje bliver kørt og printet indtil nuværendeTal ikke længere er mindre end slutTal\")\n        print(\"nuværendeTal er nu: \", nuværendeTal)\n\nrunloop.run(main()) # start main"
    },
    "8": {
      "title": "Sådan gentages kode indtil et kriterie er nået",
      "text": "nuværendeTal = 0\nslutTal = 10\n\nwhile nuværendeTal < slutTal: # gentag lige så længe nuværendetal er mindre en slutTal\n    nuværendeTal = nuværendeTal + 1\n    print(\"Denne linje bliver kørt og printet indtil nuværendeTal ikke længere er mindre end slutTal\")\n    print(\"nuværendeTal er nu: \", nuværendeTal)"
    },
    "10": {
      "title": "Sådan gentages kode for evigt",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    while True: # gentag lige så længe Sandt = Sandt (☺)\n        print(\"Denne linje bliver kørt og printet for evigt\")\n\nrunloop.run(main()) # start main"
    },
    "11": {
      "title": "Sådan gentages kode for evigt",
      "text": "while True: # gentag lige så længe Sandt = Sandt (☺)\n    print(\"Denne linje bliver kørt og printet for evigt\")"
    }
  },
  "Hub Spike Prime.pptx": {
    "4": {
      "title": "Sådan bruges Hub Lys-Matrixen (Tekst)",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger main\nfrom hub import light_matrix # fortæl programmet at vi bruger Hub lys-matrixen\n\nasync def main(): # main\n    # sæt lys-matrixen til at skrive Hej Verden!\n    # await betyder \"vent på dette bliver færdigt\"\n    await light_matrix.write(\"Hej Verden!\")\n\nrunloop.run(main()) # start main"
    },
    "6": {
      "title": "Sådan bruges Hub Lys-Matrixen (Billeder)",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger main\nfrom hub import light_matrix # fortæl programmet at vi bruger Hub lys-matrixen\n\nasync def main(): # main\n    # sæt lys-matrixen til at vise en glad smiley\n    # await sleep_ms betyder \"vent i 1000 millisekunder (1 sekund)\"\n    light_matrix.show_image(light_matrix.IMAGE_HAPPY)\n    await runloop.sleep_ms(1000)\n\nrunloop.run(main()) # start main"
    },
    "8": {
      "title": "Sådan bruges Hub Lys-Matrixen (Individuel styring)",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger main\nfrom hub import light_matrix # fortæl programmet at vi bruger Hub lys-matrixen\n\nasync def main(): # main\n    # sæt individuel lystyrke for alle pixels i lys-matrixen til 100%    # hver pixel kan sættes til en værdi mellem 0 og 100\n    light_matrix.show([100,100,100,100,100,\n                       100,100,100,100,100,\n                       100,100,100,100,100,\n                       100,100,100,100,100,\n                       100,100,100,100,100])\n\nrunloop.run(main()) # start main"
    },
    "10": {
      "title": "Sådan bruges Hub Knap-Lyset",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet af vi bruger main\nfrom hub import light # fortæl programmet at vi bruger Hub lyset\nimport color # fortæl programmet at vi bruger farver\n\nasync def main(): # main\n    light.color(light.POWER, color.RED) # Skift tænd/sluk-knappens lys til rød\n\nrunloop.run(main()) # start main"
    },
    "12": {
      "title": "Sådan bruges Hub Højtaleren Simpelt",
      "text": "import runloop # fortæl programmet af vi bruger main\nfrom hub import sound # fortæl programmet at vi bruger sound\n\n# opsæt sammenhæng mellem akkorder og lyd-freksen i mHz\nNODER = { 'C': 524, 'C#': 554, 'D': 588, 'D#': 622, 'E': 660, 'F': 698, \n         'F#': 740, 'G': 784, 'G#': 830, 'A': 880, 'A#': 932, 'B': 988 }\n\nasync def main(): # main\n    \t# afspil noden C i 200 millisekunder på 100% lydstyrke\nawait sound.beep(NODER['C'], 200, 100) \n# afspil noden D i 200 millisekunder på 100% lydstyrke\nawait sound.beep(NODER['D'], 200, 100) \n# afspil noden E i 100 millisekunder på 100% lydstyrke\nawait sound.beep(NODER['E'], 100, 100) \n# afspil noden F i 200 millisekunder på 100% lydstyrke\nawait sound.beep(NODER['F'], 200, 100) \n\nrunloop.run(main()) # start main"
    }
  },
  "Hvis ... Ellers.pptx": {
    "4": {
      "title": "Sådan opsættes et Hvis - Ellers",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    frugt = \"Banan\" # frugt kan sættes til at være hvad som helst\n   \n    if frugt == \"Æble\":\n        print(\"Frugten er et Æble!\")\n    else:\n        print(\"Frugten er ikke et æble..\")\n\nrunloop.run(main()) # start main"
    },
    "5": {
      "title": "Sådan opsættes et Hvis - Ellers",
      "text": "frugt = \"Banan\" # frugt kan sættes til at være hvad som helst\n\nif frugt == \"Æble\":\n    print(\"Frugten er et Æble!\")\nelse:\n    print(\"Frugten er ikke et æble..\")"
    },
    "7": {
      "title": "Sådan opsættes et Hvis - Ellers Hvis - Ellers",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    frugt = \"Banan\" # frugt kan sættes til at være hvad som helst\n   \n    if frugt == \"Æble\": \n        print(\"Frugten er et Æble!\")\n    elif frugt == \"Banan\":\n        print(\"Frugten er en Banan!\")\n    elif frugt == \"Pære\":\n        print(\"Frugten er en Pære!\")\n    else:\n        print(\"Frugten er hverken et æble, en banan eller en pære..\")\n\nrunloop.run(main()) # start main"
    },
    "8": {
      "title": "Sådan opsættes et Hvis - Ellers Hvis - Ellers",
      "text": "frugt = \"Banan\" # frugt kan sættes til at være hvad som helst\n\nif frugt == \"Æble\":\n    print(\"Frugten er et Æble!\")\nelif frugt == \"Banan\":\n    print(\"Frugten er en Banan!\")\nelif frugt == \"Pære\":\n    print(\"Frugten er en Pære!\")\nelse:\n    print(\"Frugten er hverken et æble, en banan eller en pære..\")"
    }
  },
  "Kraftsensor.pptx": {
    "4": {
      "title": "Sådan måler knappen kraft - ‘false-true’",
      "text": "import force_sensor # fortæl programmet at vi bruger kraft-sensoren\n\nforce_sensor.pressed(port.A) # mål om knappen er trykket på"
    },
    "5": {
      "title": "Eksempel for måling af knap - ‘false-true’",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport force_sensor # fortæl programmet at vi bruger kraft-sensoren\n\nasync def main(): # main\n    force = force_sensor.pressed(port.A) # mål om knappen er trykket på\n    print(force) # print målingen\n\nrunloop.run(main()) # start main"
    },
    "6": {
      "title": "Sådan måler knappen kraft - ‘false-true’",
      "text": "from mindstorms import ForceSensor # fortæl programmet at vi bruger knap-sensoren\n\nForceSensor('A').is_pressed(): # måler om knappen i port A er trykket på eller ikke"
    },
    "7": {
      "title": "Eksempel for måling af knap - ‘false-true’",
      "text": "from mindstorms import ForceSensor # fortæl programmet at vi bruger knap-sensoren\n\n# Tjek forevigt om knappen trykkes på \nwhile True: # gentag så længe Sandt er lig med Sandt (forevigt)\n    if ForceSensor('A').is_pressed(): # hvis knappen i port A er trykket på\n        print(\"Knappen er trykket ned!\")"
    },
    "9": {
      "title": "Sådan måler knappen kraft - ‘0 til 100’",
      "text": "import force_sensor # fortæl programmet at vi bruger kraft-sensoren\n\nforce_sensor.force(port.A) # mål kraft i Newton"
    },
    "10": {
      "title": "Eksempel for måling af knap fra - ‘0 til 100’",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport force_sensor # fortæl programmet at vi bruger kraft-sensoren\n\nasync def main(): # main\n    force = force_sensor.force(port.A) # mål kraft i Newton (0-100)\n    print(force) # print målingen\n\nrunloop.run(main()) # start main"
    },
    "11": {
      "title": "Sådan måler knappen kraft - ‘0 til 100’",
      "text": "from mindstorms import ForceSensor # fortæl programmet at vi bruger knap-sensoren\n\nForceSensor('A').get_force_newton() # mål kraften knappen fra port A er trykket ned med"
    },
    "12": {
      "title": "Eksempel for måling af knap - ‘0 til 100’",
      "text": "from mindstorms import ForceSensor # fortæl programmet at vi bruger knap-sensoren\n\n# Tjek forevigt om knappen trykkes på \nwhile True: # gentag så længe Sandt er lig med Sandt (forevigt)\n    # Opret en variable der kan holde værdien af den målte afstand\n    # og mål kraften knappen fra port A er trykket ned med\n    force = ForceSensor('A').get_force_newton()\n\n    print(\"Knappen er trykket ned med: \", force, \" kraft\")"
    }
  },
  "Mapping.pptx": {
    "3": {
      "title": "Mapping",
      "text": "Kan bruges til at sammenligne to talrækker.\n\nEksempel: Guitar-opgaven\nPå guitar stangen, kan afstandsmåleren måle mellem 0-40cm\nNår knappen trykkes på, skal der spilles 1 ud af 12 toner\n\nMapping oversætter længden 0-40cm til tone 1-12 baseret på den målte afstand"
    },
    "4": {
      "title": "Udregning",
      "text": "Målt afstand / Max afstand = Proportionen (giver et tal mellem 0 og 1)\nProportion * Max antal toner = Tone.\n\nEksempel: Hvis spille-klodsen sidder midt på guitar stangen\n20 cm / 40 cm = 0,5\n0,5 * 12 = 6 \nNår spille-klodsen sidder midt på guitar stangen, bliver tone 6 ud af 12 spillet"
    }
  },
  "Motor.pptx": {
    "4": {
      "title": "Sådan køres Motor i retning",
      "text": "import motor # fortæl programmet at vi bruger motorene\n\n# motorene kan køre mellem -1000 til 1000 hastighed\nmotor.run(port.A, 1000) # kør enkelt motor max hastighed med uret"
    },
    "5": {
      "title": "Eksempel for kørsel af Motor i retning",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport motor # fortæl programmet at vi bruger motorene\n\nasync def main(): # main\n    # motorene kan køre mellem -1000 til 1000\n    motor.run(port.A, 1000) # kør enkelt motor max hastighed med uret\n\nrunloop.run(main()) # start main"
    },
    "6": {
      "title": "Sådan køres Motor i retning",
      "text": "from mindstorms import Motor # Fortæl programmet af vi bruger Motor\n\nmotorA = Motor('A') # Initialiser motoren på port A\n\n# Motorene kan køre mellem -100% og 100%\nmotorA.start(100) # Start motor A på 100% hastighed"
    },
    "8": {
      "title": "Sådan køres Motor X grader i retning",
      "text": "import motor # fortæl programmet at vi bruger motorene\n\n# motorene kan rotere -360 til 360 grader\n# motorene kan køre mellem -1000 til 1000 hastighed\n# kør enkelt motor 180 grader max hastighed med uret\nmotor.run_for_degrees(port.A, 180, 1000)"
    },
    "9": {
      "title": "Eksempel for kørsel af Motor X grader i retning",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport motor # fortæl programmet at vi bruger motorene\n\nasync def main(): # main\n    # motorene kan rotere -360 til 360 grader\n    # motorene kan køre mellem -1000 til 1000 hastighed\n    # kør enkelt motor 180 grader ved max hastighed med uret\n    await motor.run_for_degrees(port.A, 180, 1000)\n\nrunloop.run(main()) # start main"
    },
    "10": {
      "title": "Sådan køres Motor X grader i retning",
      "text": "from mindstorms import Motor # Fortæl programmet af vi bruger Motor\n\nmotorA = Motor('A') # Initialiser motoren på port A\n\n# motorene kan rotere -360 til 360 grader\n# motorene kan køre mellem -1000 til 1000 hastighed\n# kør enkelt motor 180 grader ved max hastighed med uret\nmotorA.run_for_degrees(180, 100)"
    },
    "12": {
      "title": "Sådan køres Motor til position i retning",
      "text": "import motor # fortæl programmet at vi bruger motorene\n\n# motorene kan rotere TIL -360 til 360 grader\n# motorene kan køre mellem -1000 til 1000 hastighed\n# kør enkelt motor TIL 180 grader med max hastighed med uret\nmotor.run_to_absolute_position(port.A, 180, 1000, direction = motor.CLOCKWISE)"
    },
    "13": {
      "title": "Eksempel for kørsel af Motor TIL position i retning",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport motor # fortæl programmet at vi bruger motorene\n\nasync def main(): # main\n    # motorene kan roteres TIL -360 til 360 grader\n    # motorene kan køre mellem -1000 til 1000 hastighed\n    # kør enkelt motor TIL position på max hastighed med uret\n    await motor.run_to_absolute_position(port.A, 180, 1000, direction = motor.CLOCKWISE)\n\nrunloop.run(main()) # start main"
    },
    "14": {
      "title": "Sådan køres Motor til position i retning",
      "text": "from mindstorms import Motor # Fortæl programmet af vi bruger Motor\n\nmotorA = Motor('A') # Initialiser motoren på port A\n\n# motorene kan roteres TIL -360 til 360 grader\n# motorene kan køre mellem -1000 til 1000 hastighed\n# kør enkelt motor TIL position på max hastighed med uret\nmotorA.run_to_position(180, 'clockwise', 100)"
    },
    "16": {
      "title": "Eksempel for kørsel af to Motorer til position i retning på samme tid",
      "text": "from hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\nimport runloop # fortæl programmet at vi bruger main\nimport motor # fortæl programmet at vi bruger motorene\n\nasync def Main(): # runloop Main\n    # motorene kan roteres TIL -360 til 360 grader\n    # motorene kan køre mellem -1000 til 1000 hastighed\n    # Navngiv og begynd to opgaver: kør til 180 grader med max hastighed med uret\n    opgaveA = motor.run_to_absolute_position(port.A, 180, 1000, direction=motor.CLOCKWISE) \n    opgaveB = motor.run_to_absolute_position(port.B, 180, 1000, direction=motor.CLOCKWISE) \n\n    # Vent på begge opgaver - rækkefølgen er ligemeget\n    await opgaveA\n    await opgaveB\n\n    # når begge opgaver er 'løst' kan koden fortsætte\n\nrunloop.run(Main()) # start runloop Main"
    }
  },
  "Vent.pptx": {
    "3": {
      "title": "Sådan bruges vent i X sekunder",
      "text": "import runloop # fortæl programmet af vi bruger main\n\nasync def main(): # main\n    await runloop.sleep_ms(1000) # lad programmet sove HER i 1000 millisekunder\n\nrunloop.run(main()) # start main"
    },
    "4": {
      "title": "Sådan bruges vent i X sekunder",
      "text": "from mindstorms.control import wait_for_seconds # Fortæl programmet at vi bruger vent\n\n# Vent i 3 sekunder (sæt programflowet på pause).\nwait_for_seconds(3)\nprint(\"Så er der ventet i 3 sekunder\")"
    },
    "6": {
      "title": "Sådan bruges vent indtil …",
      "text": "import runloop # fortæl programmet at vi bruger Main evighedsløkken\nimport distance_sensor # fortæl programmet at vi bruger afstandsmåleren\nfrom hub import port # fortæl programmet at vi bruger Hub portene(A,B,C,D,E,F)\n\nasync def main(): # main\n    print(\"Venter på objekt...\")\n\n    # Mål første afstand\n    distance = distance_sensor.distance(port.A)\n\n    # Vent indtil afstandsmåleren måler mere end 100 mm\n    while distance is not None and distance < 100:\n        distance = distance_sensor.distance(port.A)\n        await runloop.sleep_ms(50) # lille pause for at undgå CPU-overbelastning\n        print(\"Afstand: \", distance, \" mm\")\n\n    print(\"Objekt længere væk end 100 mm eller ikke registreret.\")\n\nrunloop.run(main()) # start main"
    },
    "7": {
      "title": "Sådan bruges vent indtil …",
      "text": "from mindstorms import ColorSensor # Fortæl programmet at vi bruger farve sensor\nfrom mindstorms.control import wait_until # Fortæl programmet at vi bruger 'vent indtil'\nfrom mindstorms.operator import equal_to # Fortæl programmet at vi bruger 'lig med'\n\ncolor_sensor = ColorSensor('A') # Initialiser farve sensor\n\n# Vent, indtil farvesensoren ser en rød farve\nwait_until(color_sensor.get_color, equal_to, 'red')\nprint(\"Så har robotten set rød!\")"
    }
  }
};
