# FitTrack — audit de cod și experiență, 3 octombrie 2026

Evaluare la commitul `ce6ea1c`. Nota generală: **7,8/10**. Designul este aproape de **9/10**; corectitudinea datelor și comportamentul în situații dificile reduc nota produsului. Notele sunt aprecierea mea, nu rezultatul unui benchmark sau al unei certificări.

Nu am modificat codul aplicației. Acest document este rezultatul auditului.

## Cum am verificat

Am parcurs aplicația în browser folosind componentele reale din proiect și preview-ul local de pe portul 4300. Preview-ul folosește servicii simulate pentru autentificare, profil, API și vreme. Prin urmare, verificările vizuale și interacțiunile nu reprezintă verificarea integrării cu Firebase/MongoDB din producție.

Am folosit un cont de test, fără ștergerea sau modificarea unui cont real. Am inspectat separat serviciile și rutele backend și am executat probe izolate ale codului TypeScript pentru condițiile de eroare descrise mai jos.

Dimensiuni verificate: telefon mic 320 × 568, telefon 515 × 853 și desktop 1280 × 900; unele interacțiuni au fost verificate și la alte dimensiuni intermediare. Am urmărit încadrarea pe ecran, suprapunerile, tranzițiile, navigarea și continuitatea între ecrane. Nu am măsurat FPS pe dispozitiv și nu am testat Safari/iOS, GPS în teren sau aplicația Android instalată pe telefon.

Scenarii parcurse:

- Autentificare: formular, validarea unui email invalid; onboarding: date personale, obiectiv și frecvență. Autentificarea reală și recuperarea parolei nu au fost executate cu servicii reale.
- Home: calendar, activitate, obiective, trecerea între ecrane și efectul creării unei rutine asupra statisticilor.
- Workouts: creare, pornire, modificarea valorilor prin butoane, skip, revenire, pauză 1:30, review și salvare. Am verificat și colecția Push Pull Legs.
- Lower Home: exercițiul de 30 secunde, start, pause, resume și finish early. Timerul a rămas la aceeași valoare în pauză. Ecranul activ și confirmarea Stop s-au încadrat pe telefonul mic.
- History: detaliile seriilor, volumul, harta traseului și încadrarea confirmării Delete. Nu am șters date de producție.
- Weight: înregistrarea greutății, grafic, schimbarea perioadei și consultarea unei date anterioare; comparație cu Account.
- Nutrition: aspectul calculatorului în ambele teme și în unități imperiale; Assistant: filtrare vegan/lunch/budget/maximum 10 minute, rețetă, ingrediente, instrucțiuni și alternativă.
- Run: harta și panourile pe telefon mic; recuperarea unei înregistrări simulate de 10 minute/1 km și salvarea ei în History.
- Settings: Light/Dark, persistența temei după reload, unități și validarea obiectivelor.

La final am restaurat tema Light, am închis tabul creat pentru audit și am resetat dimensiunea browserului.

## Note pentru fiecare zonă

| Zonă | Nota /10 | Observație |
| --- | ---: | --- |
| Design general | 9 | Identitate coerentă, ierarhie bună și controale bine finisate. |
| Tema Light | 8,8 | Curată; câteva texte mici au contrast insuficient. |
| Tema Dark | 9 | Suprafețe și accente coerente în ecranele verificate. |
| Liquid glass | 8,5 | Arată bine în browserul testat; efectul diferă între motoarele de browser. |
| Adaptare mobil | 8,5 | Ecranul de antrenament și dialogurile testate încap inclusiv la 320 px. Tastatura reală a telefonului rămâne de verificat. |
| Adaptare desktop | 8,3 | Funcțională și consistentă; unele suprafețe mari au mult spațiu nefolosit. |
| Navigare | 8,8 | Destinații clare și acces bun la Weight, Account și Settings. |
| Login/register | 7,5* | Formulare curate; accesibilitatea etichetelor și integrarea reală necesită verificări suplimentare. |
| Onboarding | 8,5 | Pași ușor de urmărit, validări și rezultat lizibil. |
| Home — aspect | 8,8 | Calendarul și activitatea sunt bine integrate. |
| Home — progres corect | 6,5 | Crearea unei rutine poate fi numărată drept antrenament efectuat. |
| Bibliotecă și planuri | 8,8 | Colecții clare și acces direct la antrenamente; nota e pentru experiență, nu o validare sportivă a programelor. |
| Crearea unui workout | 7 | Formularul este util, dar rezultatul este confundat cu o sesiune efectuată. |
| Antrenament activ | 8 | Skip/revenire și butoanele de ajustare funcționează; lipsesc checkpoint-urile durabile ale sesiunii. |
| Timere și pauze | 9 | Timerul de hold, pause/resume și pauza de 1:30 au funcționat în scenariile testate. |
| History | 7,5 | Detalii lizibile și volum corect în exemplul testat; include și rutinele create. |
| Run — hartă și interfață | 8,5 | Traseu și panouri bine integrate; GPS-ul real nu a fost testat în teren. |
| Run — recuperare | 8,5 | Înregistrarea de test a păstrat timpul, distanța și traseul la recuperare/salvare. |
| Run — telefon blocat/background | 5* | Checkpoint-urile protejează datele deja colectate; nu există integrare nativă pentru tracking continuu în background. |
| Weight și grafic | 9 | Actualizare pe zi, perioade și explorarea datelor sunt bine realizate. |
| Account | 8 | Clar, dar afișarea greutății pierde zecimalele vizual. |
| Nutrition calculator | 8 | Aspect bun după încheierea tranziției; feedback-ul la eșecul salvării este slab. |
| Nutrition Assistant | 8,8 | Filtre și rezultate utile, prezentate coerent cu restul aplicației. |
| Settings | 8 | Temele și obiectivele sunt clare; ștergerea contului are defecte de backend importante. |
| Consistența unităților | 6,5 | Unele ecrane respectă Imperial, dar workout-urile și Run păstrează kg/km. |
| Accesibilitate | 6,5 | Există suport reduced motion; lipsesc unele etichete și contrastul unor texte este prea mic. |
| Fluiditate percepută | 8,5 | Tranziții și interacțiuni bune în browser; nu este o măsurătoare pe telefon. |
| Performanță | 8* | Lazy loading și optimizări utile; bundle-ul inițial și CSS-ul merită reduse. Fără profilare pe hardware modest. |
| Arhitectura codului | 7,5 | Servicii și semnale bine organizate; modelul rutină/sesiune necesită separare. |
| Fiabilitatea datelor | 6,5 | Retry-urile pot duplica înregistrări, iar un răspuns de upload poate suprascrie o editare. |
| Validarea API | 7 | Izolare pe utilizator și validarea greutății sunt bune; workout-urile acceptă date și serii invalide. |
| Securitate și ștergerea contului | 6* | Două defecte confirmate în fluxul de ștergere. Nu am efectuat un penetration test complet. |
| Teste automate | 7,5 | Testele existente trec, dar nu acoperă toate cazurile critice găsite. |
| Pregătire Android | 5,5* | Proiect Capacitor existent; tracking-ul în background și integrarea reală nu sunt validate pe dispozitiv. |

`*` Evaluare provizorie sau limitată la cod/configurație și preview, fără integrarea/dispozitivul real. Nota generală acordă o pondere mai mare păstrării datelor și corectitudinii progresului decât aspectului. Nu este media aritmetică a tabelului.

## Probleme confirmate și ordinea recomandată

### 1. P1 — O rutină creată este tratată drept antrenament efectuat

**Reprodus în browser și confirmat în cod.** Am creat o rutină cu un singur exercițiu, fără să execut vreo serie. Home a trecut de la 1/4 la 2/4, a adăugat 14 kcal și 2 minute. La prima pornire, rutina deja apărea drept performanță anterioară. După efectuare și salvare, History conținea atât rutina, cât și sesiunea nouă, iar Home a ajuns la 3/4.

Crearea și finalizarea folosesc același `addWorkout`, cu `isPredefined: false`. `loadPersonalRoutines` transformă toate înregistrările nepredefinite în rutine personale. În consecință, o sesiune efectuată poate deveni încă un card în bibliotecă.

Surse: [creare](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:948), [bibliotecă](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:1061), [salvare sesiune](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:1374), [progres Home](/Users/cristian/FitTrack-Angular/src/app/features/dashboard/dashboard.component.ts:123).

Remediere: entități separate pentru rutină și sesiune efectuată; progresul, istoricul și performanța anterioară să folosească exclusiv sesiunile efectuate.

### 2. P1 — Un token încă valid poate recrea profilul după ștergerea contului

**Confirmat printr-o probă izolată a middleware-ului și rutei reale.** Middleware-ul verifică tokenul fără verificarea revocării și face imediat upsert al profilului. Ruta GET `/me` verifică existența utilizatorului Firebase numai dacă profilul lipsește; upsert-ul îl creează înainte ca această condiție să fie evaluată. În probă, GET a răspuns 200 și verificarea existenței utilizatorului Firebase nu a fost apelată.

Nu am demonstrat acces între conturi diferite. Defectul privește un token rămas valid al aceluiași cont șters. Verificarea standard a tokenului nu include automat revocarea; documentația Firebase descrie acest comportament și durata tokenurilor: [verificarea tokenurilor](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [gestionarea sesiunilor](https://firebase.google.com/docs/auth/admin/manage-sessions).

Surse: [middleware](/Users/cristian/FitTrack-Angular/server/src/middleware/auth.ts:30), [verificare prea târzie](/Users/cristian/FitTrack-Angular/server/src/routes/me.routes.ts:36).

Remediere: verificați starea/revocarea identității înainte de orice upsert și blocați recrearea conturilor șterse în toate rutele protejate.

### 3. P1 — Ștergerea contului poate afișa succes după un eșec Firebase

**Confirmat prin probă izolată.** Ștergerea datelor MongoDB este urmată de ștergerea identității Firebase. Dacă Firebase eșuează, excepția este doar logată, iar API-ul răspunde în continuare `{ deleted: true }`. Interfața închide sesiunea și indică succes, deși identitatea poate exista în continuare.

Separat, cache-urile locale ale profilului, workout-urilor și alergărilor nu sunt eliminate complet la ștergerea contului. Ele sunt separate pe utilizator, dar rămân pe dispozitiv.

Surse: [ștergere backend](/Users/cristian/FitTrack-Angular/server/src/routes/me.routes.ts:168), [eroare ignorată](/Users/cristian/FitTrack-Angular/server/src/routes/me.routes.ts:188), [clear local](/Users/cristian/FitTrack-Angular/src/app/core/services/profile.service.ts:194).

Remediere: flux de ștergere reluabil, cu stare explicită și confirmare reală a tuturor etapelor; curățarea datelor locale aferente contului.

### 4. P2 — Retry-ul unei salvări poate crea înregistrări duplicate

**Confirmat prin executarea izolată a handlerului real de creare.** Trimiterea de două ori a aceluiași payload cu același ID local produce două înregistrări. Backend-ul nu folosește ID-ul local drept cheie de deduplicare; schema îl elimină și POST creează întotdeauna un document nou.

Scenariu: serverul salvează, răspunsul se pierde, clientul păstrează înregistrarea locală ca nesincronizată și o retrimite. Harta upload-urilor în curs previne unele cereri simultane, dar nu rezolvă retry-urile după pierderea răspunsului sau reload. Aceeași structură există pentru alergări.

Surse: [upload workout](/Users/cristian/FitTrack-Angular/src/app/core/services/workout.service.ts:90), [POST backend](/Users/cristian/FitTrack-Angular/server/src/routes/workouts.routes.ts:52), [running service](/Users/cristian/FitTrack-Angular/src/app/core/services/running-session.service.ts:141).

Migrarea datelor vechi are un risc similar: inserarea documentelor și marcarea migrării sunt operații separate. Proba izolată a reprodus duplicarea după inserare reușită, eșecul marcării și retry. Sursa: [migrare](/Users/cristian/FitTrack-Angular/server/src/routes/migrate.routes.ts:63).

Remediere: identificator stabil de operație, unic pentru fiecare utilizator, și scrieri idempotente inclusiv pentru migrare.

### 5. P2 — Un upload în curs poate suprascrie o editare mai nouă

**Confirmat printr-o probă izolată a serviciului real.** O înregistrare locală a fost editată în timpul POST-ului. Răspunsul întârziat a înlocuit editarea cu versiunea veche trimisă inițial. `updateWorkout` salvează local când ID-ul este temporar; `upload` înlocuiește apoi înregistrarea fără să păstreze modificările intervenite.

Sursa: [înlocuire la răspuns](/Users/cristian/FitTrack-Angular/src/app/core/services/workout.service.ts:98), [editare temporară](/Users/cristian/FitTrack-Angular/src/app/core/services/workout.service.ts:126).

Remediere: serializarea editării după upload sau păstrarea/retrimiterea unei revizii locale mai noi.

### 6. P2 — Workout-ul activ nu are salvare durabilă intermediară

**Confirmat prin inspectarea codului.** Seriile curente sunt păstrate în memorie și sunt salvate la final. `beforeunload` poate cere confirmare la părăsire, dar nu persistă sesiunea și nu protejează împotriva terminării procesului de către sistem.

Alergările au checkpoint-uri; antrenamentele cu serii nu au un mecanism echivalent. Nu am simulat terminarea procesului pe un telefon real.

Surse: [stare în memorie](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:777), [inițializare](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:1082), [beforeunload](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:937).

Remediere: draft persistent pe utilizator după fiecare schimbare relevantă, cu restaurare și ștergere explicită după salvarea finală.

### 7. P2 — Vremea poate afișa valorile de la momentul greșit

**Confirmat prin probă izolată cu date simulate.** Codul caută o potrivire exactă între ora curentă și orele forecast-ului. Pentru 14:15, într-o serie cu 14:00/15:00, cade la indexul zero. În probă a ratat ploaia din apropiere și a afișat UV 0 în locul valorii din ora curentă.

AQI și PM2.5 sunt luate din ultimul punct al forecast-ului, nu din momentul curent. Proba a afișat AQI 180 din viitor în loc de 20 în prezent, influențând scorul de alergare. Preview-ul vizual are vreme simulată; acest defect nu a fost observat pe un răspuns live în browser.

Surse: [index orar](/Users/cristian/FitTrack-Angular/src/app/core/services/weather.service.ts:140), [AQI/PM2.5](/Users/cristian/FitTrack-Angular/src/app/core/services/weather.service.ts:165), [ultimul punct](/Users/cristian/FitTrack-Angular/src/app/core/services/weather.service.ts:253). Formatul seriilor este documentat de [Open-Meteo forecast](https://open-meteo.com/en/docs) și [Air Quality](https://open-meteo.com/en/docs/air-quality-api).

Remediere: alegerea valorilor după timestamp, separat pentru forecast și calitatea aerului.

### 8. P2 — Validarea workout-urilor pe server este incompletă

**Confirmat prin probă izolată.** Handlerul a acceptat `date: 'not-a-date'`, `sets: 2.5` și liste de valori pe serie cu lungimi diferite. Formularul obișnuit previne o parte din aceste intrări, dar API-ul trebuie să păstreze aceleași reguli.

Sursa: [schema workout](/Users/cristian/FitTrack-Angular/server/src/routes/workouts.routes.ts:7).

Remediere: date calendaristice valide, numere întregi unde este necesar și verificări între numărul seriilor și valorile pe serie. Validarea pentru weigh-in este mai strictă și are teste dedicate care trec.

### 9. P2 — Unitățile și unele detalii de accesibilitate sunt inconsistente

Am verificat în preview că Imperial schimbă unitățile din Home/Weight/Nutrition. În schimb, workout-urile, History și Run au încă unități kg/km în mai multe locuri. Înregistrarea 74,2 kg din Weight apare ca 74 kg în Account din cauza rotunjirii la afișare; nu este o dovadă de pierdere a valorii stocate.

Surse: [rotunjire](/Users/cristian/FitTrack-Angular/src/app/core/utils/units.ts:37), [input workout](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.html:395).

Unele etichete vizuale de formular nu sunt asociate programatic cu input-ul. Am observat acest lucru în Login/Register și pentru anumite câmpuri din Onboarding/Nutrition. Unele texte mici au culoarea `#86868b` pe `#f5f5f7`, aproximativ 3,33:1, sub pragul de 4,5:1 pentru text obișnuit din [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Nu am efectuat o certificare WCAG sau un test complet cu cititor de ecran.

Remediere: formatter comun pentru unități, păstrarea preciziei relevante și audit al label/for/aria-label și contrastului.

### 10. Limitare de produs — GPS continuu în background

Codul de Run folosește `navigator.geolocation`. Configurația Android are permisiuni de locație, dar nu un serviciu de tracking în background/foreground. Instalarea pachetului Capacitor Geolocation nu produce singură acest comportament.

Checkpoint-urile la poziție, aproximativ cinci secunde și ascunderea paginii ajută la recuperarea datelor deja colectate. Ele nu pot recupera coordonate pe care browserul nu le-a mai colectat. Specificația web condiționează cererile de poziție de starea documentului: [Geolocation — request a position](https://www.w3.org/TR/geolocation/#request-a-position).

Surse: [watchPosition](/Users/cristian/FitTrack-Angular/src/app/features/running/running.component.ts:223), [checkpoint](/Users/cristian/FitTrack-Angular/src/app/features/running/running.component.ts:519), [manifest Android](/Users/cristian/FitTrack-Angular/android/app/src/main/AndroidManifest.xml), [MainActivity](/Users/cristian/FitTrack-Angular/android/app/src/main/java/com/fittrack/app/MainActivity.java).

Pentru un produs de alergare nativ trebuie verificată o implementare de tracking și testată pe dispozitiv cu ecran blocat, revenire în aplicație și terminarea procesului. În acest audit nu am pretins că aceste teste au trecut. Politica publică de confidențialitate are încă o adresă de contact placeholder, `support@fittrack.example.com`, care trebuie înlocuită înainte de publicare.

## Observație ce necesită reconfirmare

În preview, introducerea directă a unei greutăți de 25 kg urmată imediat de Finish și Edit a revenit la valoarea anterioară de 50 kg. Ajustarea prin butoanele plus/minus a păstrat corect valorile. Câmpurile sincronizează starea prin `(change)`, nu `(input)`, deci momentul confirmării/blur-ului merită verificat.

Nu clasific această observație drept defect de producție confirmat: metoda de introducere din automatizarea browserului poate influența evenimentele. Este necesară reproducerea prin tastare normală pe un telefon și în browser. Încercările de select-all care au produs accidental valoarea invalidă 5025 nu sunt dovezi ale unei erori de salvare; validarea a respins corect acea valoare.

Surse: [eveniment input](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.html:407), [valoarea salvată](/Users/cristian/FitTrack-Angular/src/app/features/start-workout/start-workout.component.ts:1243).

## Detalii de polish

- Eșecul exportului și unele eșecuri de autosave în Nutrition sunt doar logate, fără feedback clar pentru utilizator. Surse: [export](/Users/cristian/FitTrack-Angular/src/app/core/services/profile.service.ts:174), [autosave](/Users/cristian/FitTrack-Angular/src/app/features/bmi/bmi.component.ts:175).
- Nutrition permite zero zile de strength training, dar persistența obiectivului săptămânal folosește minimum unu. Este o inconsistență confirmată în cod, fără reproducere dedicată în browser în acest audit.
- Formatul pace-ului din History poate rotunji secundele la 60 fără a incrementa minutele; pentru 359,6 secunde/km rezultatul ar fi 5'60" în loc de 6'00". Defect de formatare identificat în cod.
- Descrierea din meniu promite „reminders”, dar Settings nu prezintă o setare de reminders.
- Calculatorul Nutrition are contrast bun după terminarea animației. O captură luată în timpul tranziției a părut inițial prea palidă; nu am considerat acea captură un defect final de contrast.

## Ce este implementat bine în cod

- Lazy loading pentru rute și încărcarea selectivă a resurselor. Există optimizări în afara zonei Angular pentru hartă/glass și curățarea observer-elor/timerelor.
- Cache-urile sunt separate pe utilizator, iar serviciile au protecții împotriva unor răspunsuri întârziate de la un cont anterior.
- Actualizările profilului sunt serializate și au rollback la eșec.
- Ștergerea unui workout încă în upload așteaptă POST-ul; eșecul unei ștergeri nu elimină prematur înregistrarea locală.
- Run are validarea draft-ului recuperat, checkpoint-uri și filtrarea unor poziții GPS neplauzibile.
- Volumul afișat în History a fost corect pentru exemplul cu valori diferite pe serie: 1.460 kg. Nu am confundat cu o formulă auxiliară nefolosită de acel ecran.
- Există suport pentru reduced motion/transparency și fallback al glass-ului în browsere fără refracția folosită în Chromium.

## Verificări automate executate

| Verificare | Rezultat |
| --- | --- |
| `npm test -- --watch=false` | 90 teste, 21 fișiere — trecute |
| `npm run build` | Reușit; avertisment CommonJS pentru Leaflet |
| `npm --prefix server run typecheck` | Reușit |
| Testele backend `weight-routes.test.ts` | 2 teste — trecute |
| Probe izolate suplimentare | Au confirmat recrearea profilului, succesul fals la delete, momentul greșit în Weather, editarea suprascrisă, duplicarea POST-ului, lacunele validării și duplicarea la retry-ul migrării |

În total, **92 de teste existente au trecut**. Probele suplimentare sunt verificări izolate executate pentru audit, nu teste noi adăugate în repository și nu cereri trimise în producție.

Build-ul inițial are aproximativ 1,33 MB necomprimat / 243 kB estimați la transfer. CSS-ul inițial are aproximativ 696 kB necomprimat. Aceste cifre sunt rezultate ale build-ului, nu măsurători de latență sau consum de memorie pe un telefon.

Nu am efectuat build/test Android, test de autentificare reală, alergare în teren, test pe Safari sau audit complet de securitate. Aceste limite sunt reflectate în notele provizorii.
