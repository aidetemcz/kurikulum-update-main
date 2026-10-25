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
