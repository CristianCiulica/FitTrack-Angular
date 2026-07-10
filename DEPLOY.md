# Deploy FitTrack — frontend pe Firebase Hosting + backend pe Render

Frontend-ul live (https://fittrack-angular-7ca07.web.app) are nevoie de un backend public.
`http://localhost:4000` nu functioneaza de pe web: nu exista pe alte dispozitive, iar paginile
HTTPS blocheaza oricum apelurile HTTP (mixed content).

## 1. MongoDB Atlas (baza de date in cloud) — o singura data

1. Cont gratuit pe https://www.mongodb.com/cloud/atlas/register
2. Creeaza un cluster **M0 (Free)**, regiunea `eu-central-1 (Frankfurt)`.
3. Database Access → Add New Database User → user + parola generata (noteaz-o).
4. Network Access → Add IP Address → **Allow access from anywhere (0.0.0.0/0)**
   (Render nu are IP fix pe planul gratuit).
5. Clusters → Connect → Drivers → copiaza connection string-ul si inlocuieste parola:
   `mongodb+srv://USER:PAROLA@cluster0.xxxxx.mongodb.net/fittrack?retryWrites=true&w=majority`

## 2. Render (backend-ul Express) — o singura data

1. Cont gratuit pe https://render.com (Sign in with GitHub).
2. New → **Web Service** → alege repo-ul `FitTrack-Angular`.
3. Setari:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
   - Settings → **Health Check Path**: `/api/health`
4. Environment → adauga variabilele:
   | Cheie | Valoare |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | connection string-ul de la Atlas (pasul 1.5) |
   | `CORS_ORIGIN` | `https://fittrack-angular-7ca07.web.app,https://fittrack-angular-7ca07.firebaseapp.com` |
   | `FIREBASE_PROJECT_ID` | `fittrack-angular-7ca07` |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | continutul fisierului `server/firebase-service-account.json`, pe UN SINGUR rand |
   Pentru JSON pe un rand: `cat server/firebase-service-account.json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)))"`
5. Deploy. La final primesti un URL gen `https://fittrack-api.onrender.com`.
   Verifica: `https://<url>/api/health` trebuie sa raspunda `{"status":"ok",...}`.

## 3. Refa build-ul frontend cu API-ul public — la fiecare deploy

In `.env` (radacina proiectului) seteaza:
```
API_BASE_URL=https://<serviciul-tau>.onrender.com/api
```
apoi:
```
npm run build && npx firebase deploy --only hosting
```

> Pentru dezvoltare locala pune inapoi `API_BASE_URL=http://localhost:4000/api`
> (sau tine doua fisiere si copiaza-l pe cel potrivit inainte de build).

## Note

- Login-ul (email + Google) functioneaza deja pe domeniul web.app — cheia Firebase
  are referer-ul permis si domeniile default sunt autorizate.
- Planul Free de la Render adoarme serviciul dupa ~15 min de inactivitate;
  primul request dupa pauza dureaza ~30-60s (cold start).
- Datele din Mongo-ul local NU se muta singure in Atlas. Daca vrei sa le pastrezi:
  `mongodump --db fittrack` local, apoi `mongorestore --uri "<MONGO_URI_ATLAS>" dump/fittrack`.
