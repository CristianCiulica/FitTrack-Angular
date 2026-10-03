# FitTrack — corecții și verificare, 4 octombrie 2026

**Evaluarea mea pentru experiența web verificată: 9/10**, față de 7,8/10 în auditul anterior. Este o apreciere a produsului și a scenariilor testate, nu o certificare, o promisiune de absență a bugurilor sau o măsurătoare de performanță pe telefon. Designul existent a fost păstrat.

## Corecții livrate

| Problemă din audit | Rezultat |
| --- | --- |
| Rutinele create măreau activitatea și apăreau în History | `kind: routine/session` separă explicit biblioteca de sesiunile executate. Home, History, volumul și valorile anterioare exclud rutinele noi. |
| Repetarea POST-ului dubla datele | Identificatori stabili pe client, indexuri unice pe utilizator și operație, upsert idempotent și reconciliere a cache-ului. Se aplică workout-urilor, alergărilor și migrării. |
| Editarea în timpul upload-ului se pierdea | Editarea se trimite după obținerea ID-ului serverului; modificările neconfirmate se păstrează pentru retry. |
| Workout-ul activ dispărea la întrerupere | Checkpoint pe utilizator după schimbări și periodic; restaurarea seriilor, valorilor tastate, pauzei și timerului. Hold-ul recuperat revine în pauză. |
| Tastarea urmată imediat de Finish păstra valoarea veche | Sincronizare la input, verificări pentru valori goale/invalide și confirmare blocată până la corectare. |
| Salvare raportată ca succes fără stocare durabilă | Distincție între server, cache local și memorie; la eșecul simultan al upload-ului și stocării, workout-ul rămâne deschis pentru retry. |
| Dublu click la creare/editare | Butonul de confirmare și închiderea modalului sunt blocate cât timp salvarea este în curs. |
| Profil recreat cu tokenul unui cont șters | Verificarea revocării/stării Firebase înainte de acces; middleware-ul nu mai creează profiluri. |
| Succes fals la ștergerea contului | Ștergere reluabilă, marcaj persistent și retry automat. Un eșec Firebase nu produce confirmare de succes. |
| Cache rămas după ștergere | Eliminarea stocării aferente contului și invalidarea serviciilor; răspunsurile întârziate nu rescriu profilul/cache-ul șters. |
| Vreme de la ora greșită | Se selectează separat ora relevantă pentru prognoză și calitatea aerului. |
| Date/serii invalide acceptate de API | Validare de date calendaristice, numere întregi, limite finite, liste pe serie și intervale de alergare. |
| kg/km afișate în Imperial | Conversii comune în workout, sumar, History și Run; greutatea păstrează zecimala, pace-ul poate trece corect la minutul următor. |
| Autosave/export fără feedback de eroare | Feedback explicit și rollback pentru autosave; exportul raportează eșecurile. |
| Zero zile de strength training nu se salva corect | Câmp separat 0–7 pentru Nutrition, independent de obiectivul săptămânal de workout-uri. |
| Etichete și contrast | Etichete asociate, controale descrise și culori secundare mai lizibile. Nu reprezintă certificare WCAG. |
| CSS inițial mare | Sunt încărcate stilurile componentelor folosite și dependențele lor. CSS: aproximativ 696 → 458 kB; total inițial: 1,33 → 1,10 MB, transfer estimat 243 → 222 kB. |
| GPS doar în WebView pe Android | Serviciu foreground de locație, notificare, checkpoint nativ și recuperare prin bridge. GPS-ul se oprește la logout, iar checkpoint-ul rămâne al utilizatorului. |

Înregistrările istorice fără `kind` sunt păstrate. Datele vechi nu permit întotdeauna identificarea sigură a unei rutine față de o sesiune; nu s-a făcut o ștergere sau reclasificare globală bazată pe presupuneri. Noile înregistrări sunt separate explicit.

## Verificări executate

- **111 teste frontend, 24 fișiere:** trecute. Include restaurarea workout-ului, input imediat, date invalide, editare în timpul upload-ului, răspuns pierdut, cache șters, unități și separarea rutinelor.
- **11 teste backend:** trecute. Include validare, izolare pe utilizator, retry idempotent, conflict concurent, migrare după eșecul marcajului și ștergerea identității cu erori simulate.
- **Build de producție Angular:** reușit. Avertismentul existent pentru distribuția CommonJS Leaflet rămâne; nu blochează build-ul.
- **Typecheck și build backend:** reușite.
- **Android assembleDebug și testDebugUnitTest:** reușite. Patru teste GPS relevante plus testul exemplu existent: cinci teste trecute. APK-ul include web build-ul de producție sincronizat prin Capacitor.
- **CI:** frontend și backend se verifică automat la push/PR.

Testele backend folosesc modele/identitate simulate și servere HTTP locale. Ele verifică logica reală a handlerelor și serviciilor; nu înlocuiesc un test de integrare cu MongoDB/Firebase reale.

## Experiență verificată în browser

Preview-ul folosește componentele reale cu autentificare, profil, API și vreme simulate, fără ștergerea unui cont real. Reîncărcarea completă reinițializează API-ul demonstrativ; acest lucru nu este comportamentul backend-ului de producție.

- Crearea unei rutine: activitatea rămâne 1/4, fără calorii/minute adăugate. După executarea unei serii, progresul devine 2/4.
- Input 9 repetări și 25 kg: se păstrează după reload, Finish și Edit. Sumarul arată 225 kg.
- Pauză: 1:30. Pauza și review-ul se încadrează la 320 × 568.
- Weight: actualizarea la 74,2 kg modifică graficul și Account păstrează 74,2 kg.
- Imperial: History afișează 2,67 mi, pace 9'21"/mi și volumul în lb; Run afișează mi. Nutrition are input-uri separate pentru feet/inches.
- Settings, dialoguri, Nutrition Assistant și traseul prin meniu: parcurse în Light/Dark.
- Nutrition Assistant: Maintain → Lunch → Vegan → ≤10 min → Budget; rezultat compatibil, ingrediente, instrucțiuni și alternative lizibile.

## Evaluarea pe zone

| Zonă | /10 | Baza evaluării |
| --- | ---: | --- |
| Aspect și consistență Light/Dark | 9 | Stilul păstrat, contrast și componente verificate. |
| Home și corectitudinea progresului nou | 9,2 | Biblioteca nu mai mărește activitatea; limite de săptămână explicite. |
| Biblioteca / planuri / creare | 9 | Rutine separate, salvare și feedback. |
| Workout activ / timere / recuperare | 9,2 | Input, skip/revenire, pauză și restaurare verificate. |
| History și unități | 9 | Sesiuni filtrate, conversii și detalii pe serie. |
| Weight și Account | 9 | Grafic, actualizare și precizie consistentă. |
| Nutrition și Assistant | 9 | Filtre, formulare și feedback verificate. |
| Settings și gestionarea datelor | 9 | Ștergere fără succes fals și export cu feedback. |
| Navigare și fluiditate percepută | 9 | Parcursuri coerente; resurse inițiale reduse, actualizări GPS fără redesenare inutilă. Fără măsurători FPS pe telefon. |
| Login / onboarding / accesibilitate | 8,8* | Etichete și contrast îmbunătățite; autentificarea reală și cititorul de ecran nu au fost testate aici. |
| Fiabilitate / API / securitate | 9* | Defectele confirmate au corecții și teste. Nu este audit de securitate exhaustiv. |
| Run pe web | 8,8* | Interfață și recuperare; browserul poate suspenda GPS cu ecranul blocat. |
| Run nativ Android | Provizoriu | Implementare și build/teste trecute; test de teren cu telefon blocat încă necesar. |

`*` Nota are limitele de integrare/dispozitiv descrise aici. Nota generală nu este media aritmetică și nu certifică publicarea în Play Store.

## Validări externe încă necesare

Nu există un telefon/emulator conectat în această sesiune. Nu am pretins că un test GPS real a trecut. Înainte de release nativ: pornire Run cu permisiuni, ecran blocat minimum 10 minute, redeschidere, rută/timp/distanță, oprire/salvare, oprire forțată și recuperare, GPS dezactivat/reactivat, logout și ștergere de cont pe un cont de test. Verificați și login-ul Google pe Android cu configurația și semnăturile release.

Pagina de confidențialitate descrie stocarea/tracking-ul actual și nu mai conține email fictiv. Identitatea/contactul operatorului și cerințele Play Console trebuie completate cu date reale înainte de publicare.

Un browser nu poate garanta colectarea GPS când sistemul suspendă pagina. Implementarea Android folosește serviciul de locație permis de [documentația Android foreground services](https://developer.android.com/develop/background-work/services/fgs/service-types). Nici o aplicație nu poate promite continuare după force-stop; checkpoint-ul protejează ceea ce s-a înregistrat deja. Verificarea tokenurilor revocate urmează [Firebase — Manage user sessions](https://firebase.google.com/docs/auth/admin/manage-sessions).
