☻# Kvízovka 🟥🔷🟡🟩

Školská kvízová hra v štýle Kahoot. Učiteľ premieta otázky na projektor, tímy odpovedajú na mobiloch/tabletoch, body sa počítajú za správnosť aj rýchlosť a na konci sa vyhlasujú stupne víťazov (top 3).

- **Administrácia** – tvorba kvízov v editore, obrázky k otázkam, kategórie, import/export z Excelu
- **Tímy** – pripoja sa cez PIN alebo QR kód, zvolia si názov tímu (jedno zariadenie = jeden tím). Neskoro prišlé tímy sa môžu pripojiť aj počas hry; učiteľ môže hru tlačidlom so zámkom zamknúť pre nové tímy a tímy vyhodiť kedykoľvek počas hry. Ak karta projektora spadne, hra sa po uplynutí času posunie sama (odpočet a vyhodnotenie), ďalej pokračuje po jej opätovnom otvorení.
- **Hra** – časový limit na otázku, 2–4 odpovede, vysvetlenie po odhalení odpovede, priebežné poradie, finálne pódium s konfetami, export výsledkov do CSV

## Ako to funguje

| Časť                                     | Technológia                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| Frontend                                 | React + Vite + Tailwind CSS (nasadený na **Vercel**) |
| Databáza, realtime, obrázky, prihlásenie | **Supabase** (free tier stačí)                       |

Vercel nevie držať trvalé WebSocket spojenia, preto realtime synchronizáciu hry rieši Supabase. Všetka herná logika (časovanie, bodovanie, kontrola odpovedí) beží v databáze – správna odpoveď sa do mobilov nedostane skôr, než ju projektor odhalí, a podvádzať zmenou času na mobile sa nedá.

```
Projektor (učiteľ, /host/…) ──RPC──▶ Supabase Postgres ◀──RPC── Mobily tímov (/play)
          ▲                              │ realtime                    ▲
          └──────────────────────────────┴─────────────────────────────┘
```

---

## 1. Nastavenie Supabase (raz, ~5 minút)

1. Zaregistruj sa na [supabase.com](https://supabase.com) a vytvor nový projekt (región napr. _Central EU (Frankfurt)_).
2. **SQL Editor → New query** → vlož celý obsah súboru [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**. Potom rovnako spusti aj ďalšie súbory z [`supabase/migrations/`](supabase/migrations/) v poradí podľa čísla (`0002_explanation.sql`, …).
3. **Authentication → Users → Add user → Create new user** – zadaj e-mail a heslo učiteľa, zaškrtni _Auto Confirm User_.
4. V SQL Editore pridaj tento e-mail medzi administrátorov:
   ```sql
   insert into public.admin_emails (email) values ('ucitel@skola.sk');
   ```
   (e-mail malými písmenami; takto môžeš pridať aj viac učiteľov)
5. _Odporúčané:_ **Authentication → Sign In / Providers → Email** → vypni **Allow new users to sign up** (účty vytváraš ručne v kroku 3).
6. _Voliteľné:_ spusti [`supabase/seed.sql`](supabase/seed.sql) – pridá ukážkový kvíz s 8 otázkami.
7. **Project Settings → API** (alebo tlačidlo **Connect**) – skopíruj **Project URL** a **anon / publishable key**.

> ⚠️ Bezplatný Supabase projekt sa po 7 dňoch nečinnosti uspí. Pred kvízom sa prihlás do Supabase a ak je projekt pozastavený, klikni na **Restore** (trvá to pár minút).

## 2. Nasadenie na Vercel

1. Nahraj tento priečinok do GitHub repozitára.
2. Na [vercel.com](https://vercel.com) → **Add New → Project** → importuj repozitár (framework _Vite_ sa rozpozná sám).
3. V **Environment Variables** pridaj:
   - `SUPABASE_URL` = Project URL (bez `/rest/v1/` na konci)
   - `SUPABASE_ANON_KEY` = anon / publishable key

   Ak prepojíš Supabase cez Vercel integráciu, tieto dve premenné sa nastavia samé. Do aplikácie sa dostanú len tieto dve – ostatné (napr. `SUPABASE_SERVICE_ROLE_KEY`) zostanú tajné.
4. **Deploy**. Hotovo – aplikácia beží na `https://<nazov>.vercel.app`.

Pri zmene premenných prostredia treba spraviť **Redeploy** (hodnoty sa vkladajú do aplikácie pri zostavení).

### Zamknutie webu počas vývoja

Kým aplikácia nie je hotová, môžeš celý web zamknúť heslom: vo Verceli pridaj premennú **`SITE_PASSWORD`** = ľubovoľné heslo a daj **Redeploy**. Prehliadač potom pri otvorení stránky vypýta meno a heslo (meno môže byť čokoľvek). Zámok rieši [`middleware.js`](middleware.js) priamo na serveri Vercelu, takže bez hesla sa nestiahne ani kód stránky.

Pri spustení pre žiakov premennú `SITE_PASSWORD` zmaž a daj znova **Redeploy**. Lokálne (`npm run dev`) zámok nie je.

## 3. Lokálny vývoj

```bash
cp .env.example .env      # doplň URL a kľúč zo Supabase
npm install
npm run dev               # http://localhost:5173
```

`npm run dev` beží s `--host`, takže sa môžeš pripojiť aj z mobilu v rovnakej WiFi cez adresu `Network: http://192.168.x.x:5173`, ktorú vypíše terminál.

Ďalšie príkazy:

| Príkaz              | Čo robí                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build`     | kontrola typov + produkčné zostavenie do `dist/`                                                                                                       |
| `npm run typecheck` | len kontrola typov                                                                                                                                     |
| `npm run test:sql`  | testy hernej logiky v SQL (bodovanie, časovanie, práva) – bežia lokálne v PGlite, Supabase netreba                                                     |
| `npm run test:e2e`  | celá hra proti tvojmu Supabase projektu (host + 3 tímy cez realtime); potrebuje v `.env` aj `E2E_ADMIN_EMAIL` a `E2E_ADMIN_PASSWORD`, po sebe upratuje |
| `npm run test:middleware` | test zámku webu heslom (`SITE_PASSWORD`) |

---

## Ako prebieha kvíz

1. Učiteľ otvorí **`/admin`**, prihlási sa a pri kvíze klikne **Spustiť hru**.
2. Na projektore sa zobrazí **PIN** a **QR kód**. Tímy otvoria hlavnú stránku aplikácie (alebo naskenujú QR), zadajú PIN a názov tímu.
3. Tímy sa objavujú na projektore (kliknutím na tím ho môžeš vyhodiť, napr. pri nevhodnom názve). Keď sú všetci, klikni **Spustiť**.
4. Každá otázka: 5 s sa zobrazuje otázka (aj s obrázkom) → otvoria sa odpovede a beží čas → po vypršaní času (alebo keď odpovedia všetky tímy) sa odhalí správna odpoveď so štatistikou → ak má otázka vysvetlenie, tlačidlo **Vysvetlenie** otvorí samostatnú obrazovku s otázkou, vysvetlením (text a vlastný obrázok) a správnou odpoveďou → priebežné poradie.
5. Po poslednej otázke **pódium top 3**, celé poradie a stiahnutie výsledkov do CSV (otvorí sa v Exceli).

Ovládanie projektora: **Medzerník / Enter / →** = ďalší krok, vpravo hore stlmenie zvuku a celá obrazovka. Ak sa stránka projektora obnoví alebo zatvorí, hra pokračuje tam, kde skončila – stačí ju znova otvoriť (aj zo zoznamu **Posledné hry** v administrácii). To isté platí pre mobily tímov.

### Bodovanie

- Správna odpoveď: **500 – 1000 bodov** podľa rýchlosti (okamžitá odpoveď ≈ 1000, odpoveď na poslednú chvíľu ≈ 500).
- Otázka s **dvojnásobnými bodmi**: 1000 – 2000. Otázka **bez bodov**: 0 (napr. na zahriatie).
- Nesprávna alebo žiadna odpoveď: 0.
- Čas meria server, nie mobil.

### Import z Excelu

V administrácii klikni **Stiahnuť šablónu**, vyplň ju a nahraj cez **Importovať z Excelu** (nový kvíz) alebo v editore cez **Importovať otázky** (pridať k existujúcim).

| Kategória | Otázka                         | Odpoveď A | Odpoveď B  | Odpoveď C | Odpoveď D | Správna | Čas (s) | Body | Obrázok (URL) | Vysvetlenie                | Obrázok k vysvetleniu (URL) |
| --------- | ------------------------------ | --------- | ---------- | --------- | --------- | ------- | ------- | ---- | ------------- | -------------------------- | --------------------------- |
| Geografia | Hlavné mesto Slovenska?        | Košice    | Bratislava | Žilina    | Nitra     | B       | 20      | 1    |               | Hlavné mesto od roku 1993. |                             |
| Šport     | Koľko hráčov má futbalový tím? | 9         | 11         |           |           | B       | 15      | 2    |               |                            |                             |

- **Správna**: A / B / C / D (alebo 1–4) · **Čas**: 5–240 s (predvolene 20) · **Body**: 1 = štandardné, 2 = dvojnásobné, 0 = bez bodov
- Odpovede C a D sú nepovinné, obrázok je nepovinný (verejná URL – alebo ho nahraj neskôr v editore).
- **Vysvetlenie** je nepovinné (najviac 300 znakov) – na projektore má po odhalení správnej odpovede samostatnú obrazovku, na mobiloch tímov sa zobrazí pod výsledkom.
- **Obrázok k vysvetleniu** je nepovinný (verejná URL alebo nahratie v editore) – ukáže sa na obrazovke vysvetlenia namiesto obrázka otázky. Vysvetlenie môže byť aj len obrázok bez textu.
- Podporované sú `.xlsx`, `.xls` aj `.csv` (UTF-8).

---

## Štruktúra projektu

```
supabase/migrations/               schéma, práva (RLS) a herná logika (RPC funkcie) – spúšťať v poradí
supabase/seed.sql                  ukážkový kvíz
tests/sql.test.mjs                 testy SQL logiky (PGlite)
src/lib/                           API, realtime, synchronizácia času, typy, zvuky
src/components/                    spoločné UI komponenty (tlačidlá, tvary odpovedí, odpočet…)
src/pages/play/                    mobil tímu – pripojenie a hra
src/pages/host/                    projektor – lobby, otázky, poradie, pódium
src/pages/admin/                   administrácia – kvízy, editor, import/export
```
