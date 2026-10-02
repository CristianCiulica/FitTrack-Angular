# Revizie de cod — 1 octombrie 2026

Această listă documentează probleme existente în afara modificărilor cerute pentru workouts, hărți, Liquid Glass și eliminarea Community. Au rămas nemodificate pentru a respecta cerința „În rest nu modifici nimic”. Constatările provin din analiza codului; nu am executat ștergeri de conturi sau migrări pe date de producție.

## Probleme de urmărit

| Prioritate | Problemă și efect | Dovezi în cod |
| --- | --- | --- |
| P1 | Un token încă valabil al unui cont șters poate recrea profilul. Middleware-ul validează tokenul fără verificarea revocării și face imediat upsert; verificarea existenței contului din `GET /me` rulează numai dacă profilul lipsește, deci este ocolită de acel upsert. | `server/src/middleware/auth.ts:30`, `:39`; `server/src/routes/me.routes.ts:31` |
| P1 | Ștergerea contului raportează succes chiar dacă ștergerea utilizatorului Firebase eșuează. Datele Mongo sunt șterse anterior, eroarea Firebase este doar înregistrată, iar răspunsul rămâne `{ deleted: true }`. | `server/src/routes/me.routes.ts:120`, `:139`, `:145` |
| P2 | Salvarea profilului transformă orice eroare API în succes local. Interfața poate confirma salvarea numelui, fotografiei sau unităților, deși serverul nu a acceptat datele; o reîncărcare ulterioară poate readuce valorile vechi. Nu există o coadă de sincronizare pentru aceste modificări. | `src/app/core/services/profile.service.ts:87`, `:101` |
| P2 | Vremea poate utiliza intervale greșite. Pentru un `current.time` care nu coincide exact cu o oră din tabel, indexul devine `0`; ploaia și UV sunt calculate din începutul prognozei. AQI/PM2.5 sunt luate din ultimul element al prognozei, fără corelare cu ora curentă. | `src/app/core/services/weather.service.ts:122`, `:147`, `:235` |
| P2 | Migrarea datelor locale poate duplica înregistrări la retry sau cereri concurente. Inserările și marcarea migrării sunt operații separate; dacă marcarea eșuează după inserare, următoarea cerere inserează din nou. | `server/src/routes/migrate.routes.ts:54`, `:61`, `:72` |
| P2 | Dashboard și Nutrition pot afișa ținte calorice diferite pentru același profil. Dashboard folosește permanent factorul `1.375`, iar Nutrition folosește frecvența antrenamentelor, obiectivul și ritmul salvate. | `src/app/features/dashboard/dashboard.component.ts:220`; `src/app/features/bmi/bmi.component.ts:108`, `:133` |
| P2 | Asistentul nutrițional modifică energia și macronutrienții afișați în funcție de obiectiv, dar păstrează exact aceleași cantități de ingrediente. Recomandarea afirmă că porția a fost ajustată, fără să ajusteze rețeta. | `src/app/features/dashboard/nutrition-assistant.data.ts:908`, `:959`, `:965` |

## Acoperire și limite

Revizia a acoperit serviciile, modelele, guard-urile, interceptorul și configurarea Angular; autentificarea, profilul, contul, setările, onboarding-ul, dashboard-ul, calculatorul nutrițional și logica asistentului; formularul de workout; rutele, modelele, middleware-ul și configurarea Express/Mongo/Firebase. Workouts, sesiunea activă, hărțile și stilurile comune au fost revizuite separat în cadrul implementării cerute.

Community a fost eliminat din client și din înregistrarea rutelor API. Profilul păstrează fotografia și accesul la datele personale. Ștergerea unui cont continuă să elimine și eventualele postări, comentarii, aprecieri și relații de urmărire din vechile colecții Community; nu s-a făcut o ștergere globală de date existente.

Validare pentru eliminarea Community: typecheck backend reușit, verificare a importurilor/referințelor și verificare a diferențelor Git. Testele și verificarea vizuală pentru întregul set de modificări sunt raportate separat la livrare.
