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
