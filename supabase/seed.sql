-- Ukážkový kvíz na vyskúšanie (voliteľné). Spusti v Supabase → SQL Editor
-- až po všetkých súboroch zo supabase/migrations.
with quiz as (
  insert into public.quizzes (title, description)
  values ('Ukážkový kvíz', 'Krátky kvíz na vyskúšanie aplikácie – rôzne kategórie.')
  returning id
)
insert into public.questions (quiz_id, position, category, text, answers, correct, time_limit, points, explanation)
select quiz.id, q.position, q.category, q.text, q.answers, q.correct, q.time_limit, q.points, q.explanation
from quiz, (values
  (0, 'Geografia', 'Ktoré mesto je hlavným mestom Slovenska?', array['Košice', 'Bratislava', 'Žilina', 'Banská Bystrica'], 1, 20, 1000,
      'Bratislava je hlavným mestom samostatného Slovenska od roku 1993.'),
  (1, 'Geografia', 'Ktorý je najvyšší štít Slovenska?', array['Lomnický štít', 'Kriváň', 'Gerlachovský štít', 'Rysy'], 2, 20, 1000,
      'Gerlachovský štít meria 2 655 m a je najvyšším vrchom celých Karpát.'),
  (2, 'Príroda', 'Koľko nôh má pavúk?', array['6', '8', '10', '12'], 1, 15, 1000,
      'Pavúky nie sú hmyz, ale pavúkovce – hmyz má 6 nôh, pavúky 8.'),
  (3, 'Príroda', 'Ktorá planéta je najbližšie k Slnku?', array['Venuša', 'Mars', 'Merkúr', 'Zem'], 2, 20, 1000, ''),
  (4, 'Šport', 'Koľko hráčov má futbalový tím na ihrisku?', array['9', '10', '11', '12'], 2, 15, 1000,
      '10 hráčov v poli a 1 brankár.'),
  (5, 'História', 'V ktorom roku vznikla samostatná Slovenská republika?', array['1989', '1993', '1918', '2004'], 1, 20, 2000,
      'Slovenská republika vznikla 1. januára 1993 rozdelením Česko-Slovenska.'),
  (6, 'Matematika', 'Koľko je 7 × 8?', array['54', '56', '58', '64'], 1, 10, 1000, ''),
  (7, 'Jazyk', 'Je „y“ v slove „byť“ správne?', array['Áno', 'Nie'], 0, 10, 1000,
      '„Byť“ je vybrané slovo po b – píšeme tvrdé y.')
) as q(position, category, text, answers, correct, time_limit, points, explanation);
