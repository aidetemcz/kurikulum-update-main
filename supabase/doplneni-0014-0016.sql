-- Doplnění chybějících migrací 0014 a 0016 a názvů metodik v SK/HU/EN.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run.
-- Dá se spustit i opakovaně, nic se tím nerozbije.

-- ===== migrations/0014_module_name_translations.sql =====
-- Názvy metodik ve slovenštině a maďarštině (angličtina má vlastní name_en).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Všechny země vidí celý katalog. Aby mu rozuměly, má každá metodika
-- název i v jejich jazyce: {"sk": "...", "hu": "..."}. Import z českého
-- webu tenhle sloupec nepřepisuje.
alter table modules
  add column if not exists name_translations jsonb not null default '{}'::jsonb;

-- ===== migrations/0016_country_module_names.sql =====
-- Vlastní název metodiky pro jednu zemi.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Metodika se v každé zemi může jmenovat jinak (u nás „Poezie mezi
-- prompty“, v Maďarsku úplně jinak). Přejmenování platí jen pro danou
-- zemi, ostatní dál vidí svůj název.
create table if not exists country_module_names (
  country_id uuid not null references countries (id) on delete cascade,
  module_id uuid not null references modules (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  updated_at timestamptz not null default now(),
  primary key (country_id, module_id)
);

alter table country_module_names enable row level security;

-- Číst smí každý přihlášený; zapisuje server po kontrole práv (service role).
drop policy if exists "vlastni nazvy vidi prihlaseni" on country_module_names;
create policy "vlastni nazvy vidi prihlaseni" on country_module_names
  for select to authenticated using (true);

grant select on country_module_names to authenticated;

-- ===== seed/nazvy-sk-hu.sql =====
-- Názvy všech metodik ve slovenštině a maďarštině, přeložené z češtiny.
-- Kde se metodika týká mateřského jazyka (Český jazyk 01), je přeložená
-- podle smyslu: na Slovensku slovenský, v Maďarsku maďarský jazyk –
-- stejně jako ji anglický web vede jako English 03.
-- Vyžaduje migraci 0014. Spustit v Supabase: SQL Editor -> Run.

update public.modules m
set name_translations = coalesce(m.name_translations, '{}'::jsonb)
  || jsonb_build_object('sk', v.sk, 'hu', v.hu)
from (values
  ('01-roboti-se-predstavuji-vnimani-a-uceni', '01 Roboti sa predstavujú — Vnímanie a učenie', '01 Bemutatkoznak a robotok — Érzékelés és tanulás'),
  ('02-roboti-v-muzeu-co-je-a-co-neni-ai', '02 Roboti v múzeu — Čo je a čo nie je AI', '02 Robotok a múzeumban — Mi az MI, és mi nem az?'),
  ('03-roboti-si-cisti-zuby-algritmus-a-strojove-uceni', '03 Roboti si čistia zuby — Algoritmus a strojové učenie', '03 A robotok fogat mosnak — Algoritmus és gépi tanulás'),
  ('04-data-cloud-roboti-s-hlavou-v-oblacich', '04 Roboti s hlavou v oblakoch — Dáta a cloud', '04 Robotok a felhők között — Adatok és felhő'),
  ('05-uceni-se-z-prikladu-roboti-na-vystave-kocek', '05 Roboti na výstave mačiek — Učenie sa z príkladov', '05 Robotok a macskakiállításon — Tanulás példákból'),
  ('06-roboti-dobrodruzstvi-v-muzeu-uceni-se-z-prikladu', '06 Robotie dobrodružstvo v bludisku — Učenie sa zo skúseností', '06 Robotkaland a labirintusban — Tanulás tapasztalatból'),
  ('07-predpojatost-ju-a-pi-na-nakupu', '07 Ju a Pí na nákupe — Predpojatosť', '07 Ju és Pí vásárolni megy — Torzítás'),
  ('08-jazykove-modely-pi-ve-vesmiru-slov', '08 Ju a Pí vo vesmíre slov — Jazykové modely', '08 Ju és Pí a szavak univerzumában — Nyelvi modellek'),
  ('09-ambientni-inteligence-roboti-maji-domaci-mazlicky', '09 Roboti majú robopsíka — Ambientná inteligencia', '09 A robotoknak robokutyájuk van — Környezeti intelligencia'),
  ('etika-01-etika-vyvoje-a-vyuziti-technologii', 'Etika 01 — Etika vývoja a využívania technológií', 'Etika 01 — A technológiák fejlesztésének és használatának etikája'),
  ('strojove-uceni-01-dataset', 'Strojové učenie 01 — Dataset', 'Gépi tanulás 01 — Adathalmaz'),
  ('strojove-uceni-02-strojove-uceni-s-ucitelem', 'Strojové učenie 02 — Strojové učenie s učiteľom', 'Gépi tanulás 02 — Felügyelt tanulás'),
  ('strojove-uceni-03-predpojatost', 'Strojové učenie 03 — Predpojatosť', 'Gépi tanulás 03 — Torzítás'),
  ('strojove-uceni-04-posilovane-uceni', 'Strojové učenie 04 — Posilňované učenie', 'Gépi tanulás 04 — Megerősítéses tanulás'),
  ('william-meriwether-interaktivni-pribeh-pro-pochopeni-zakladu-strojoveho-uceni', 'William & Meriwether — interaktívny príbeh na pochopenie základov strojového učenia', 'William és Meriwether — interaktív történet a gépi tanulás alapjainak megértéséhez'),
  ('data-01-velka-data', 'Dáta 01 — Veľké dáta', 'Adatok 01 — Big data'),
  ('data-02-vizualizace-dat-casova-rada', 'Dáta 02 — Interpretácia dát pomocou chatbotov', 'Adatok 02 — Adatok értelmezése chatbotok segítségével'),
  ('etika-02-etika-v-rozhodovani-inteligentnich-systemu', 'Etika 02 — Etika v rozhodovaní inteligentných systémov', 'Etika 02 — Etika az intelligens rendszerek döntéshozatalában'),
  ('vibecoding-01-tvorba-jednoduchych-aplikaci', 'Vibecoding 01 — Tvorba jednoduchých aplikácií', 'Vibecoding 01 — Egyszerű alkalmazások készítése'),
  ('vytvareni-ai-asistentu-skolni-hackaton', 'Tvorba AI asistentov — Školský hackathon na zlepšenie výučby', 'MI-asszisztensek készítése — Iskolai hackathon a tanítás fejlesztéséért'),
  ('ai-nastroje-v-canva-krasnejsi-skola', 'AI nástroje v Canve — Krajšia škola', 'MI-eszközök a Canvában — Szebb iskola'),
  ('chatboti-ve-vyuce-pracovni-listy', 'Chatboty vo výučbe, pracovné listy', 'Chatbotok a tanításban, munkalapok'),
  ('rozvoj-mysleni-s-vyuzitim-chatbota', 'Rozvoj myslenia s využitím chatbota', 'A gondolkodás fejlesztése chatbot segítségével'),
  ('medialni-vychova-01-doporucovaci-systemy-na-socialnich-sitich', 'Mediálna výchova 01 — Odporúčacie systémy na sociálnych sieťach', 'Médiaismeret 01 — Ajánlórendszerek a közösségi médiában'),
  ('medialni-vychova-02-mikrocileni-darkposting', 'Mediálna výchova 02 — Mikrocielenie a dark posting', 'Médiaismeret 02 — Mikrotargetálás és dark posting'),
  ('medialni-vychova-03-vliv-generativni-ai-na-propagandu', 'Mediálna výchova 03 — Vplyv generatívnej AI na propagandu', 'Médiaismeret 03 — A generatív MI hatása a propagandára'),
  ('medialni-vychova-04-strojove-rozpoznavani-emoci', 'Mediálna výchova 04 — Strojové rozpoznávanie emócií', 'Médiaismeret 04 — Gépi érzelemfelismerés'),
  ('medialni-vychova-05-synteticka-realita', 'Mediálna výchova 05 — Syntetická realita', 'Médiaismeret 05 — Szintetikus valóság'),
  ('medialni-vychova-06-strojova-analyza-politickych-kampani', 'Mediálna výchova 06 — Strojová analýza vizuálov politických kampaní', 'Médiaismeret 06 — Politikai kampányok vizuális anyagainak gépi elemzése'),
  ('medialni-vychova-07-zaklady-digitalni-a-medialni-gramotnosti', 'Mediálna výchova 07 — Základy digitálnej a mediálnej gramotnosti', 'Médiaismeret 07 — A digitális és médiaműveltség alapjai'),
  ('wellbeing-01-kdo-je-sara-digitalni-stopa-osint', 'Wellbeing 01 — Kto je Sára?', 'Wellbeing 01 — Ki az a Sára?'),
  ('wellbeing-2-digitalni-blizkost', 'Wellbeing 02 — Digitálna blízkosť', 'Wellbeing 02 — Digitális közelség'),
  ('wellbeing-03-deepnudes', 'Wellbeing 03 — Deep Nudes', 'Wellbeing 03 — Szintetikus meztelenség'),
  ('anglicky-jazyk-01-digitalni-kompetence', 'Angličtina 01 — Etické a morálne dilemy', 'Angol nyelv 01 — Etikai és erkölcsi dilemmák'),
  ('anglictina-02-vynalezci-slov', 'Angličtina 02 — Vynálezcovia slov', 'Angol nyelv 02 — Szófeltalálók'),
  ('cesky-jazyk-01-digitalni-kompetence', 'Slovenský jazyk 01 — Poézia medzi promptmi', 'Magyar nyelv 01 — Költészet a promptok között'),
  ('dejepis-01-priciny-a-prekazky-vzniku-evropske-unie', 'Dejepis 01 — Príčiny a prekážky vzniku EÚ', 'Történelem 01 — Az EU létrejöttének okai és akadályai'),
  ('hudebni-vychova-01-zvukove-promeny', 'Hudobná výchova 01 — Zvukové premeny', 'Ének-zene 01 — Hangátalakítások'),
  ('hudebni-vychova-02-hudebni-zanry', 'Hudobná výchova 02 — Hudobné žánre a generovanie hudby v Suno', 'Ének-zene 02 — Zenei műfajok és zenegenerálás a Sunóval'),
  ('nabozenstvi-desatero-v-kontextu-umele-inteligence', 'Náboženstvo — Desatoro v kontexte umelej inteligencie', 'Hittan — A tízparancsolat a mesterséges intelligencia tükrében'),
  ('vytvarna-vychova-01-animace-postav', 'Výtvarná výchova 01 — Bežiaci vlk a kráčajúca Venuša', 'Vizuális kultúra 01 — A futó farkas és a lépkedő Vénusz'),
  ('vytvarna-vychova-02-algoritmicky-neviditelni', 'Výtvarná výchova 02 — Algoritmicky neviditeľní', 'Vizuális kultúra 02 — Algoritmikusan láthatatlanok'),
  ('chemie-01-hadej-chemicke-prvky', 'Chémia 01 — Hádaj chemické prvky!', 'Kémia 01 — Találd ki a kémiai elemeket!'),
  ('fyzika-01-model-cerna-skrinka', 'Fyzika 01 — Model a čierna skrinka', 'Fizika 01 — Modell és fekete doboz'),
  ('matematika-pro-zivot', 'Matematika — Matematika pre život', 'Matematika — Matematika az élethez'),
  ('prirodopis-01-rostliny-kolem-nas', 'Biológia — Rastliny okolo nás', 'Biológia — Növények körülöttünk'),
  ('zemepis-01-chytre-technologie-v-zemedelstvi', 'Geografia 01 — Inteligentné technológie v poľnohospodárstve', 'Földrajz 01 — Okos technológiák a mezőgazdaságban'),
  ('vyuziti-chatbotu-ve-formativnim-hodnoceni', 'Využitie chatbotov vo formatívnom hodnotení', 'Chatbotok használata a formatív értékelésben'),
  ('zpusoby-vyuziti-chatbotu-ve-vyuce', 'Spôsoby využitia chatbotov vo výučbe', 'A chatbotok tanórai felhasználásának módjai')
) as v (slug, sk, hu)
where m.slug = v.slug;

-- Kontrola: kolik metodik má slovenský a maďarský název.
select count(*) filter (where name_translations ? 'sk') as se_slovenskym,
       count(*) filter (where name_translations ? 'hu') as s_madarskym,
       count(*) as celkem
from public.modules
where archived_at is null;

-- ===== seed/anglicke-nazvy.sql =====
-- Anglické názvy metodik podle kurikulum.aidetem.cz/en/listing-of-everything/.
-- Párují se podle slugu české metodiky. Kde anglický web metodiku ještě
-- nemá (Coming soon) nebo má jen číslo, je název přeložený z češtiny –
-- ty řádky jsou označené komentářem „přeloženo“.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

update public.modules m
set name_en = v.name_en
from (values
  ('01-roboti-se-predstavuji-vnimani-a-uceni', '01 Meet the Robots Hoo and Ray – Perception and Learning'),
  ('02-roboti-v-muzeu-co-je-a-co-neni-ai', '02 Robots in the Museum – What Is and What Isn’t AI'),
  ('03-roboti-si-cisti-zuby-algritmus-a-strojove-uceni', '03 How Robots Brushed Their Teeth – Algorithm and Machine Learning'),
  ('04-data-cloud-roboti-s-hlavou-v-oblacich', '04 Robots with Their Heads in the Clouds – Data and Cloud'),
  ('05-uceni-se-z-prikladu-roboti-na-vystave-kocek', '05 Robots at the Cat Exhibition – Learning from Examples'),
  ('06-roboti-dobrodruzstvi-v-muzeu-uceni-se-z-prikladu', '06 Robots’ Maze Adventures – Learning from Experience'),
  ('07-predpojatost-ju-a-pi-na-nakupu', '07 Hoo and Ray Go Shopping – Bias'),
  ('08-jazykove-modely-pi-ve-vesmiru-slov', '08 Hoo and Ray in the Universe of Words – Language Model'),
  ('09-ambientni-inteligence-roboti-maji-domaci-mazlicky', '09 Robots Have a Robo-Dog – Ambient Intelligence'),
  ('etika-01-etika-vyvoje-a-vyuziti-technologii', 'Ethics 01 – Ethics in Technology Use and Development'),
  ('strojove-uceni-01-dataset', 'Machine Learning 01 – Dataset'),
  ('strojove-uceni-02-strojove-uceni-s-ucitelem', 'Machine Learning 02 – Supervised Learning'),
  ('strojove-uceni-03-predpojatost', 'Machine Learning 03 – Bias'),
  ('strojove-uceni-04-posilovane-uceni', 'Machine Learning 04 – Reinforcement Learning'),
  ('william-meriwether-interaktivni-pribeh-pro-pochopeni-zakladu-strojoveho-uceni', 'William & Meriwether – an interactive story for understanding the basics of machine learning'),
  ('data-01-velka-data', 'Data 01 – Big Data'),
  ('data-02-vizualizace-dat-casova-rada', 'Data 02 – Interpreting Data Using Chatbots'),
  ('etika-02-etika-v-rozhodovani-inteligentnich-systemu', 'Ethics 02 – Ethics in Decision Making'),
  ('vibecoding-01-tvorba-jednoduchych-aplikaci', 'Vibe Coding 01 — Creating Simple Applications Using Vibe Coding'),
  ('vytvareni-ai-asistentu-skolni-hackaton', 'Creating AI Assistants – School Hackaton'),
  ('ai-nastroje-v-canva-krasnejsi-skola', 'AI Tools in Canva – Beautiful Learning'),
  ('chatboti-ve-vyuce-pracovni-listy', 'Chatbots in the Classroom, Worksheets'),
  ('rozvoj-mysleni-s-vyuzitim-chatbota', 'Developing Thinking Skills Using a Chatbot'),
  ('medialni-vychova-01-doporucovaci-systemy-na-socialnich-sitich', 'Social Studies 01 – Recommendation Systems on Social Media'),
  ('medialni-vychova-02-mikrocileni-darkposting', 'Social Studies 02 – Microtargeting and Dark Posting'),
  -- přeloženo (na anglickém webu „Coming soon“)
  ('medialni-vychova-03-vliv-generativni-ai-na-propagandu', 'Social Studies 03 – The Impact of Generative AI on Propaganda'),
  ('medialni-vychova-04-strojove-rozpoznavani-emoci', 'Social Studies 04 – Emotion Recognition'),
  ('medialni-vychova-05-synteticka-realita', 'Social Studies 05 – Synthetic Reality'),
  -- přeloženo (na anglickém webu „Coming soon“)
  ('medialni-vychova-06-strojova-analyza-politickych-kampani', 'Social Studies 06 – Machine Analysis of Political Campaign Visuals'),
  -- přeloženo (na anglickém webu chybí)
  ('medialni-vychova-07-zaklady-digitalni-a-medialni-gramotnosti', 'Social Studies 07 – Basics of Digital and Media Literacy'),
  ('wellbeing-01-kdo-je-sara-digitalni-stopa-osint', 'Wellbeing—Who is Sarah?'),
  ('wellbeing-2-digitalni-blizkost', 'Wellbeing 02—Artificial Intimacy'),
  ('wellbeing-03-deepnudes', 'Wellbeing 03—Synthetic Nudity'),
  -- doplněno překladem (na anglickém webu jen „English 01“)
  ('anglicky-jazyk-01-digitalni-kompetence', 'English 01 – Ethical and Moral Dilemmas'),
  -- přeloženo (na anglickém webu „Coming soon“)
  ('anglictina-02-vynalezci-slov', 'English 02 – Word Inventors'),
  ('cesky-jazyk-01-digitalni-kompetence', 'English 03 – Poetry Between Prompts'),
  -- přeloženo (na anglickém webu „Coming soon“)
  ('dejepis-01-priciny-a-prekazky-vzniku-evropske-unie', 'History 01 – Causes of and Obstacles to the Creation of the EU'),
  ('hudebni-vychova-01-zvukove-promeny', 'Music Education 01 – Sound Transformations'),
  ('hudebni-vychova-02-hudebni-zanry', 'Music Education 02 – Music Genres & Generation in Suno'),
  -- přeloženo (na anglickém webu „Coming soon“)
  ('nabozenstvi-desatero-v-kontextu-umele-inteligence', 'Religious Education – The Ten Commandments in the Context of Artificial Intelligence'),
  ('vytvarna-vychova-01-animace-postav', 'Art 01 – The Running Wolf and the Walking Lady Liberty'),
  ('vytvarna-vychova-02-algoritmicky-neviditelni', 'Art 02 – Algorithmically Invisible'),
  ('chemie-01-hadej-chemicke-prvky', 'Chemistry 01 – Guess the Chemical Elements!'),
  ('fyzika-01-model-cerna-skrinka', 'Physics 01 – Model & Black Box'),
  ('matematika-pro-zivot', 'Mathematics – Real-Life Math'),
  ('prirodopis-01-rostliny-kolem-nas', 'Biology – Plants Around Us'),
  ('zemepis-01-chytre-technologie-v-zemedelstvi', 'Geography 01 – Smart Technologies in Agriculture (Board Game)'),
  ('vyuziti-chatbotu-ve-formativnim-hodnoceni', 'Using Chatbots in Formative Assessment'),
  -- přeloženo (na anglickém webu chybí)
  ('zpusoby-vyuziti-chatbotu-ve-vyuce', 'Ways of Using Chatbots in Teaching')
) as v (slug, name_en)
where m.slug = v.slug;

-- Kontrola: kolik metodik má anglický název a které ho nemají.
select count(*) filter (where name_en is not null) as s_anglickym_nazvem,
       count(*) filter (where name_en is null) as bez_anglickeho_nazvu
from public.modules
where archived_at is null;

