# Kvízovka 🟥🔷🟡🟩

Školská kvízová hra v štýle Kahoot. Učiteľ premieta otázky na projektor, tímy odpovedajú na mobiloch/tabletoch, body sa počítajú za správnosť aj rýchlosť a na konci sa vyhlasujú stupne víťazov (top 3).

- **Administrácia** – tvorba kvízov v editore, obrázky k otázkam, kategórie, import/export z Excelu
- **Tímy** – pripoja sa cez PIN alebo QR kód, zvolia si názov tímu (jedno zariadenie = jeden tím)
- **Hra** – časový limit na otázku, 2–4 odpovede, priebežné poradie, finálne pódium s konfetami, export výsledkov do CSV

## Ako to funguje

| Časť | Technológia |
|---|---|
| Frontend | React + Vite + Tailwind CSS (nasadený na **Vercel**) |
| Databáza, realtime, obrázky, prihlásenie | **Supabase** (free tier stačí) |

Vercel nevie držať trvalé WebSocket spojenia, preto realtime synchronizáciu hry rieši Supabase. Všetka herná logika (časovanie, bodovanie, kontrola odpovedí) beží v databáze – správna odpoveď sa do mobilov nedostane skôr, než ju projektor odhalí, a podvádzať zmenou času na mobile sa nedá.

```
Projektor (učiteľ, /host/…) ──RPC──▶ Supabase Postgres ◀──RPC── Mobily tímov (/play)
          ▲                              │ realtime                    ▲
          └──────────────────────────────┴─────────────────────────────┘
```

---

## 1. Nastavenie Supabase (raz, ~5 minút)

1. Zaregistruj sa na [supabase.com](https://supabase.com) a vytvor nový projekt (región napr. *Central EU (Frankfurt)*).
2. **SQL Editor → New query** → vlož celý obsah súboru [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
3. **Authentication → Users → Add user → Create new user** – zadaj e-mail a heslo učiteľa, zaškrtni *Auto Confirm User*.
4. V SQL Editore pridaj tento e-mail medzi administrátorov:
   ```sql
   insert into public.admin_emails (email) values ('ucitel@skola.sk');
   ```
   (e-mail malými písmenami; takto môžeš pridať aj viac učiteľov)
5. *Odporúčané:* **Authentication → Sign In / Providers → Email** → vypni **Allow new users to sign up** (účty vytváraš ručne v kroku 3).
6. *Voliteľné:* spusti [`supabase/seed.sql`](supabase/seed.sql) – pridá ukážkový kvíz s 8 otázkami.
7. **Project Settings → API** (alebo tlačidlo **Connect**) – skopíruj **Project URL** a **anon / publishable key**.

> ⚠️ Bezplatný Supabase projekt sa po 7 dňoch nečinnosti uspí. Pred kvízom sa prihlás do Supabase a ak je projekt pozastavený, klikni na **Restore** (trvá to pár minút).

## 2. Nasadenie na Vercel

1. Nahraj tento priečinok do GitHub repozitára.
2. Na [vercel.com](https://vercel.com) → **Add New → Project** → importuj repozitár (framework *Vite* sa rozpozná sám).
3. V **Environment Variables** pridaj:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
4. **Deploy**. Hotovo – aplikácia beží na `https://<nazov>.vercel.app`.

Pri zmene premenných prostredia treba spraviť **Redeploy** (hodnoty sa vkladajú do aplikácie pri zostavení).

## 3. Lokálny vývoj

```bash
cp .env.example .env      # doplň URL a kľúč zo Supabase
npm install
npm run dev               # http://localhost:5173
```

`npm run dev` beží s `--host`, takže sa môžeš pripojiť aj z mobilu v rovnakej WiFi cez adresu `Network: http://192.168.x.x:5173`, ktorú vypíše terminál.

Ďalšie príkazy:

| Príkaz | Čo robí |
|---|---|
| `npm run build` | kontrola typov + produkčné zostavenie do `dist/` |
| `npm run typecheck` | len kontrola typov |
| `npm run test:sql` | testy hernej logiky v SQL (bodovanie, časovanie, práva) – bežia lokálne v PGlite, Supabase netreba |
| `npm run test:e2e` | celá hra proti tvojmu Supabase projektu (host + 3 tímy cez realtime); potrebuje v `.env` aj `E2E_ADMIN_EMAIL` a `E2E_ADMIN_PASSWORD`, po sebe upratuje |

---

## Ako prebieha kvíz

1. Učiteľ otvorí **`/admin`**, prihlási sa a pri kvíze klikne **Spustiť hru**.
2. Na projektore sa zobrazí **PIN** a **QR kód**. Tímy otvoria hlavnú stránku aplikácie (alebo naskenujú QR), zadajú PIN a názov tímu.
3. Tímy sa objavujú na projektore (kliknutím na tím ho môžeš vyhodiť, napr. pri nevhodnom názve). Keď sú všetci, klikni **Spustiť**.
4. Každá otázka: 5 s sa zobrazuje otázka → otvoria sa odpovede a beží čas → po vypršaní času (alebo keď odpovedia všetky tímy) sa odhalí správna odpoveď so štatistikou → priebežné poradie.
5. Po poslednej otázke **pódium top 3**, celé poradie a stiahnutie výsledkov do CSV (otvorí sa v Exceli).

Ovládanie projektora: **Medzerník / Enter / →** = ďalší krok, vpravo hore stlmenie zvuku a celá obrazovka. Ak sa stránka projektora obnoví alebo zatvorí, hra pokračuje tam, kde skončila – stačí ju znova otvoriť (aj zo zoznamu **Posledné hry** v administrácii). To isté platí pre mobily tímov.

### Bodovanie

- Správna odpoveď: **500 – 1000 bodov** podľa rýchlosti (okamžitá odpoveď ≈ 1000, odpoveď na poslednú chvíľu ≈ 500).
- Otázka s **dvojnásobnými bodmi**: 1000 – 2000. Otázka **bez bodov**: 0 (napr. na zahriatie).
- Nesprávna alebo žiadna odpoveď: 0.
- Čas meria server, nie mobil.

### Import z Excelu

V administrácii klikni **Stiahnuť šablónu**, vyplň ju a nahraj cez **Importovať z Excelu** (nový kvíz) alebo v editore cez **Importovať otázky** (pridať k existujúcim).

| Kategória | Otázka | Odpoveď A | Odpoveď B | Odpoveď C | Odpoveď D | Správna | Čas (s) | Body | Obrázok (URL) |
|---|---|---|---|---|---|---|---|---|---|
| Geografia | Hlavné mesto Slovenska? | Košice | Bratislava | Žilina | Nitra | B | 20 | 1 | |
| Šport | Koľko hráčov má futbalový tím? | 9 | 11 | | | B | 15 | 2 | |

- **Správna**: A / B / C / D (alebo 1–4) · **Čas**: 5–240 s (predvolene 20) · **Body**: 1 = štandardné, 2 = dvojnásobné, 0 = bez bodov
- Odpovede C a D sú nepovinné, obrázok je nepovinný (verejná URL – alebo ho nahraj neskôr v editore).
- Podporované sú `.xlsx`, `.xls` aj `.csv` (UTF-8).

---

## Štruktúra projektu

```
supabase/migrations/0001_init.sql  schéma, práva (RLS) a herná logika (RPC funkcie)
supabase/seed.sql                  ukážkový kvíz
tests/sql.test.mjs                 testy SQL logiky (PGlite)
src/lib/                           API, realtime, synchronizácia času, typy, zvuky
src/components/                    spoločné UI komponenty (tlačidlá, tvary odpovedí, odpočet…)
src/pages/play/                    mobil tímu – pripojenie a hra
src/pages/host/                    projektor – lobby, otázky, poradie, pódium
src/pages/admin/                   administrácia – kvízy, editor, import/export
```
