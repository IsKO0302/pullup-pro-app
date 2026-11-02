/**
 * PULLUP PRO ORIGINALS — 90 thoughts written for this app (15 categories × 4 short + 2
 * reflections). Each language is written to read naturally on its own (same idea, not a
 * literal translation). No attributions to real people. Russian is gender-neutral.
 * Low-confidence phrasing is listed in CONTENT-REVIEW.md. Validated by thoughts.test.ts.
 */
import type { Thought, ThoughtCategory } from '../domain/types';

type Text = readonly [en: string, ru: string, tr: string];

/** Items 1–4 are short (≤ 7 words, poster-ready), 5–6 are reflections (2–4 sentences). */
function group(category: ThoughtCategory, items: readonly Text[]): Thought[] {
  return items.map(([en, ru, tr], i) => ({ id: `${category}-${i + 1}`, category, format: i < 4 ? 'short' : 'reflection', text: { en, ru, tr } }));
}

export const THOUGHTS: readonly Thought[] = [
  ...group('life', [
    ["Life goes on. So do I.", "Жизнь идёт дальше. И я тоже.", "Hayat devam ediyor. Ben de."],
    ["Not every day has to be perfect.", "Не каждый день обязан быть идеальным.", "Her gün mükemmel olmak zorunda değil."],
    ["Bad days end too.", "Плохие дни тоже заканчиваются.", "Kötü günler de biter."],
    ["Live slower. Notice more.", "Живи медленнее. Замечай больше.", "Daha yavaş yaşa. Daha çok fark et."],
    ["Some days you win. Some days you just get through. Both count.", "Бывают дни, когда побеждаешь. Бывают дни, когда просто держишься. Считаются оба.", "Bazı günler kazanırsın. Bazı günler sadece atlatırsın. İkisi de sayılır."],
    ["Life rarely waits until you feel ready. It just keeps moving. Walk with it, at your own pace.", "Жизнь редко ждёт, пока ты соберёшься с силами. Она просто идёт дальше. Иди рядом — в своём темпе.", "Hayat, kendini hazır hissetmeni pek beklemez. Akıp gider. Sen de kendi temponda onunla yürü."],
  ]),
  ...group('time', [
    ["Take your time.", "Не торопись.", "Acele etme."],
    ["A year from now, you’ll be glad.", "Через год ты скажешь себе спасибо.", "Bir yıl sonra kendine teşekkür edeceksin."],
    ["Time passes anyway. Use it.", "Время всё равно пройдёт. Используй его.", "Zaman zaten geçecek. Onu kullan."],
    ["Slow is still forward.", "Медленно — тоже вперёд.", "Yavaş da olsa ileri."],
    ["You don’t need more time. You need ten honest minutes today. Ten minutes, repeated, become a year.", "Тебе не нужно больше времени. Нужны десять честных минут сегодня. Десять минут, повторённые снова и снова, складываются в год.", "Daha fazla zamana ihtiyacın yok. Bugün dürüst on dakikaya ihtiyacın var. Tekrarlanan on dakikalar bir yıla dönüşür."],
    ["The hours pass whether you train or not. What matters is what they leave behind. That choice is quiet, and it’s yours.", "Часы пройдут в любом случае — с тренировкой или без. Важно лишь, что останется после них. Этот выбор тихий, и он твой.", "Antrenman yapsan da yapmasan da saatler geçer. Önemli olan, geride ne bıraktıklarıdır. Bu sessiz bir seçim ve senin elinde."],
  ]),
  ...group('dreams', [
    ["Dreams need a schedule.", "Мечте нужно расписание.", "Hayallerin de bir takvime ihtiyacı var."],
    ["Big dream. Small first step.", "Большая мечта. Маленький первый шаг.", "Büyük hayal. Küçük ilk adım."],
    ["Your dream won’t train for you.", "Мечта не потренируется за тебя.", "Hayalin senin yerine antrenman yapmaz."],
    ["Keep the dream. Change the plan.", "Мечту оставь. План поменяй.", "Hayali koru. Planı değiştir."],
    ["A dream is only a direction. It won’t lift you over the bar. The reps will, one at a time.", "Мечта — это только направление. Она не поднимет тебя над перекладиной. Это сделают повторения, одно за другим.", "Hayal sadece bir yöndür. Seni barın üstüne çıkarmaz. Bunu tekrarlar yapar, birer birer."],
    ["Write the dream down. Then write what you’ll do this week. Most dreams get lost on the second line.", "Запиши мечту. Потом запиши, что сделаешь на этой неделе. Большинство мечтаний теряется на второй строчке.", "Hayalini yaz. Sonra bu hafta ne yapacağını yaz. Çoğu hayal ikinci satırda kaybolur."],
  ]),
  ...group('discipline', [
    ["Show up. Then decide.", "Сначала приди. Потом решай.", "Önce gel. Sonra karar ver."],
    ["Motivation leaves. Habits stay.", "Мотивация уходит. Привычки остаются.", "Motivasyon gider. Alışkanlık kalır."],
    ["Keep the promise you made yourself.", "Сдержи обещание, данное себе.", "Kendine verdiğin sözü tut."],
    ["Quiet work, done again.", "Тихая работа — снова и снова.", "Sessiz emek, tekrar tekrar."],
    ["Discipline isn’t being hard on yourself. It’s being kind to the person you’ll be tomorrow. Today’s small yes is a gift to them.", "Дисциплина — это не жёсткость к себе. Это забота о том, кем ты станешь завтра. Сегодняшнее маленькое «да» — подарок этому человеку.", "Disiplin kendine sert davranmak değildir. Yarınki haline iyilik yapmaktır. Bugünkü küçük “evet”, ona bir hediyedir."],
    ["You won’t always feel like it. That’s normal, not a sign to stop. Start small and let the first set decide the rest.", "Желание будет не всегда. Это нормально и не повод останавливаться. Начни с малого — первый подход подскажет, что дальше.", "Her zaman canın istemeyecek. Bu normal, bırakman için bir işaret değil. Küçük başla; gerisine ilk set karar versin."],
  ]),
  ...group('patience', [
    ["Strength grows slowly. Let it.", "Сила растёт медленно. Дай ей время.", "Güç yavaş büyür. Bırak büyüsün."],
    ["One more rep. Next month.", "Ещё один повтор. В следующем месяце.", "Bir tekrar daha. Gelecek ay."],
    ["Roots first. Then height.", "Сначала корни. Потом высота.", "Önce kökler, sonra boy."],
    ["Patience is part of the program.", "Терпение — часть программы.", "Sabır da programın bir parçası."],
    ["Muscles adapt in weeks. Tendons take months. Be patient with the parts of you that grow quietly.", "Мышцы привыкают за недели. Сухожилиям нужны месяцы. Отнесись с терпением к тому, что растёт в тебе тихо.", "Kaslar haftalar içinde uyum sağlar. Tendonlar aylar ister. Sessizce güçlenen yanlarına karşı sabırlı ol."],
    ["For weeks nothing seems to change, and then one day the bar feels lighter. It was changing the whole time. You just couldn’t see it yet.", "Неделями кажется, что ничего не меняется, а потом однажды перекладина становится легче. Перемены шли всё это время. Просто их ещё не было видно.", "Haftalarca hiçbir şey değişmiyor gibi gelir, sonra bir gün bar daha hafif gelir. Değişim hep sürüyordu. Sadece henüz göremiyordun."],
  ]),
  ...group('selfRespect', [
    ["You vs. you.", "Соревнуйся только с собой.", "Sadece kendinle yarış."],
    ["Until I’m proud.", "Пока не стану гордиться собой.", "Kendimle gurur duyana kadar."],
    ["Talk to yourself like a friend.", "Говори с собой как с другом.", "Kendinle bir dostunla konuşur gibi konuş."],
    ["Respect the body that carries you.", "Уважай тело, которое тебя несёт.", "Seni taşıyan bedene saygı duy."],
    ["Comparing yourself to others is a game nobody wins. Someone is always ahead, someone always behind. The only fair race is with yesterday’s you.", "Сравнивать себя с другими — игра, в которой не бывает победителей. Кто-то всегда впереди, кто-то всегда позади. Честное соревнование только одно — с собственным вчерашним днём.", "Kendini başkalarıyla kıyaslamak, kimsenin kazanamadığı bir oyundur. Hep biri öndedir, hep biri geride. Tek adil yarış, dünkü kendinle olandır."],
    ["Stopping when something hurts isn’t quitting. It’s respect. Strong people listen to their bodies first.", "Остановиться, когда больно, — не значит сдаться. Это уважение к себе. Сильные люди сначала слушают своё тело.", "Bir yerin acıdığında durmak pes etmek değildir. Bu, kendine saygıdır. Güçlü insanlar önce bedenlerini dinler."],
  ]),
  ...group('growth', [
    ["Better than yesterday. That’s enough.", "Лучше, чем вчера. Этого достаточно.", "Dünden iyi. Bu kadarı yeter."],
    ["Uncomfortable means you’re learning.", "Неудобно — значит, ты учишься.", "Zorlanıyorsan öğreniyorsun."],
    ["Small steps. Long road.", "Маленькие шаги. Большой путь.", "Küçük adımlar. Uzun yol."],
    ["Learn the movement. Then own it.", "Сначала выучи движение. Потом сделай его своим.", "Önce hareketi öğren. Sonra onu sahiplen."],
    ["Growth rarely feels like growth. It feels like doing the same thing again, a little cleaner. Look back in three months, not three days.", "Рост редко ощущается как рост. Скорее как то же самое, только чуть чище. Оглядывайся через три месяца, а не через три дня.", "Gelişim nadiren gelişim gibi hissettirir. Aynı şeyi biraz daha temiz yapmak gibi hissettirir. Üç gün sonra değil, üç ay sonra geriye bak."],
    ["Your first pull-up isn’t the goal. It’s proof. Proof that a body can learn what it couldn’t do before.", "Первое подтягивание — не цель. Это доказательство. Доказательство того, что тело способно научиться тому, чего раньше не умело.", "İlk barfiksin amaç değil, bir kanıt. Bedenin daha önce yapamadığı bir şeyi öğrenebileceğinin kanıtı."],
  ]),
  ...group('sport', [
    ["Clean reps only.", "Только чистые повторения.", "Sadece temiz tekrarlar."],
    ["Hang. Pull. Breathe. Repeat.", "Вис. Тяга. Вдох. Ещё раз.", "Tutun. Çek. Nefes al. Tekrarla."],
    ["The bar doesn’t lie.", "Перекладина не врёт.", "Bar yalan söylemez."],
    ["Quality first. Numbers later.", "Сначала качество. Цифры потом.", "Önce kalite. Sayılar sonra."],
    ["Leave a rep or two in the tank. Not because you’re weak, but because there’s a next time. Training is a long game.", "Оставь в запасе повтор-другой. Не из слабости, а потому что будет следующий раз. Тренировки — это игра вдолгую.", "Bir iki tekrarı yedekte bırak. Zayıf olduğun için değil, bir sonraki antrenman da olacağı için. Antrenman uzun soluklu bir oyundur."],
    ["A pull-up is honest. Either your chin clears the bar or it doesn’t. There’s something calming about a thing that can’t be faked.", "Подтягивание честное. Подбородок либо выше перекладины, либо нет. Есть что-то успокаивающее в том, что нельзя подделать.", "Barfiks dürüsttür. Çenen ya barı geçer ya geçmez. Taklit edilemeyen bir şeyde insanı sakinleştiren bir yan var."],
  ]),
  ...group('failure', [
    ["Missed a rep? That’s just data.", "Повтор сорвался? Это просто данные.", "Tekrar kaçtı mı? Bu sadece bir veri."],
    ["Fail. Learn. Back to the bar.", "Ошибка. Вывод. Снова к перекладине.", "Hata. Ders. Yeniden bara."],
    ["Failure is a step, not a wall.", "Неудача — ступенька, а не стена.", "Başarısızlık bir basamak, duvar değil."],
    ["Today didn’t work. Tomorrow might.", "Сегодня не вышло. Завтра может получиться.", "Bugün olmadı. Yarın olabilir."],
    ["Some sets will end earlier than planned. That’s not a verdict, just information. Write it down and adjust.", "Некоторые подходы закончатся раньше, чем планировалось. Это не приговор, а информация. Запиши и подстрой план.", "Bazı setler planlanandan erken bitecek. Bu bir hüküm değil, sadece bilgi. Not al ve planı ayarla."],
    ["Everyone who can do twenty pull-ups once couldn’t do one. Failure isn’t the opposite of progress. It’s the part nobody posts.", "Каждый, кто сегодня подтягивается двадцать раз, когда-то не мог ни разу. Неудача — не противоположность прогресса. Это его часть, которую никто не выкладывает.", "Bugün yirmi barfiks çekebilen herkes bir zamanlar bir tane bile çekemiyordu. Başarısızlık ilerlemenin zıttı değildir. Kimsenin paylaşmadığı kısmıdır."],
  ]),
  ...group('success', [
    ["Success is quieter than you think.", "Успех тише, чем кажется.", "Başarı sandığından daha sessizdir."],
    ["Celebrate. Then keep going.", "Порадуйся. И продолжай.", "Kutla. Sonra devam et."],
    ["Today counts. Write it down.", "Сегодня считается. Запиши это.", "Bugün sayılır. Not al."],
    ["Win the day, not the internet.", "Выиграй день, а не интернет.", "Günü kazan, interneti değil."],
    ["Success isn’t one big moment. It’s a pile of ordinary days that weren’t wasted. Look at the pile sometimes.", "Успех — это не один большой момент. Это стопка обычных дней, прожитых не зря. Иногда оглядывайся на неё.", "Başarı tek bir büyük an değildir. Boşa geçmemiş sıradan günlerin yığınıdır. Arada bir o yığına bak."],
    ["When you reach the goal, the bar is still the same bar. What changed is the person on it. Keep that, not the trophy.", "Когда цель достигнута, перекладина остаётся той же. Меняется человек на ней. Береги это, а не трофей.", "Hedefe ulaştığında bar yine aynı bardır. Değişen, ona asılan insandır. Kupayı değil, bunu sakla."],
  ]),
  ...group('hope', [
    ["It gets lighter.", "Станет легче.", "Zamanla hafifler."],
    ["Tomorrow is a new set.", "Завтра — новый подход.", "Yarın yeni bir set."],
    ["There’s still time.", "Время ещё есть.", "Hâlâ zaman var."],
    ["Hard now. Not forever.", "Тяжело сейчас. Не навсегда.", "Şimdi zor. Sonsuza dek değil."],
    ["Hope isn’t waiting for things to get better. It’s doing one small thing as if they will. Today, that thing can be one set.", "Надежда — это не ожидание, что станет лучше. Это маленькое дело, сделанное так, будто станет. Сегодня этим делом может быть один подход.", "Umut, işlerin düzelmesini beklemek değildir. Düzelecekmiş gibi küçük bir şey yapmaktır. Bugün o şey tek bir set olabilir."],
    ["On heavy days, remember your first hang from the bar. It felt impossible then. Look where you are now.", "В тяжёлые дни вспомни свой первый вис на перекладине. Тогда это казалось невозможным. Посмотри, где ты сейчас.", "Ağır günlerde bardaki ilk asılışını hatırla. O zaman imkânsız görünüyordu. Şimdi nerede olduğuna bak."],
  ]),
  ...group('innerStrength', [
    ["I keep going.", "Я продолжаю.", "Devam ediyorum."],
    ["Calm is a kind of strength.", "Спокойствие — тоже сила.", "Sakinlik de bir güçtür."],
    ["Stronger than the excuse.", "Сильнее отговорки.", "Bahaneden güçlü."],
    ["Breathe. You’ve done harder things.", "Выдохни. Бывало и труднее.", "Nefes al. Daha zorlarını yaşadın."],
    ["Inner strength isn’t loud. It’s the voice that says “one more clean rep” and later says “enough for today”. Both take courage.", "Внутренняя сила не кричит. Это голос, который говорит «ещё один чистый повтор», а потом — «на сегодня хватит». Для обоих нужна смелость.", "İç güç yüksek sesle konuşmaz. “Bir temiz tekrar daha” diyen, sonra da “bugünlük yeter” diyen sestir. İkisi de cesaret ister."],
    ["Nobody sees the mornings you chose to show up. That’s fine. You see them, and that’s where real strength lives.", "Никто не видит, как по утрам ты всё-таки выходишь на тренировку. И это нормально. Видишь ты — и именно там живёт настоящая сила.", "Gelmeyi seçtiğin sabahları kimse görmez. Sorun değil. Sen görürsün ve gerçek güç tam orada yaşar."],
  ]),
  ...group('loneliness', [
    ["Alone isn’t the same as lost.", "Одиночество — ещё не потерянность.", "Yalnız olmak kaybolmak demek değil."],
    ["The bar is always there.", "Перекладина всегда на месте.", "Bar hep orada."],
    ["Be good company to yourself.", "Будь себе хорошей компанией.", "Kendine iyi bir yoldaş ol."],
    ["Lonely roads still lead somewhere.", "Даже одинокие дороги куда-то ведут.", "Yalnız yollar da bir yere çıkar."],
    ["Training alone can feel like nobody is watching. Somebody is: you. Let that be enough for today.", "Когда тренируешься в одиночку, кажется, что никто не видит. Но один человек видит — это ты. Пусть сегодня этого будет достаточно.", "Tek başına antrenman yapmak, kimse izlemiyormuş gibi hissettirebilir. Biri izliyor: sen. Bugün bu yeterli olsun."],
    ["Loneliness is heavy, but it isn’t permanent. Reach out to one person this week. Strength also means letting someone in.", "Одиночество тяжёлое, но оно не навсегда. Напиши на этой неделе хотя бы одному человеку. Сила — это ещё и умение подпустить кого-то ближе.", "Yalnızlık ağırdır ama kalıcı değildir. Bu hafta tek bir kişiye ulaş. Güçlü olmak, birinin sana yaklaşmasına izin vermek de demektir."],
  ]),
  ...group('newBeginnings', [
    ["Start again. It’s allowed.", "Начни заново. Так можно.", "Yeniden başla. Buna izin var."],
    ["Zero is a fine place to start.", "Ноль — нормальное место для старта.", "Sıfır, başlamak için iyi bir yer."],
    ["New week. Clean page.", "Новая неделя. Чистый лист.", "Yeni hafta. Temiz sayfa."],
    ["Coming back is strength too.", "Вернуться — это тоже сила.", "Geri dönmek de güçtür."],
    ["You don’t have to make up for lost weeks. Start lighter than you think and build from there. The body remembers more than you expect.", "Не нужно наверстывать пропущенные недели. Начни легче, чем хочется, и прибавляй понемногу. Тело помнит больше, чем кажется.", "Kaçırdığın haftaları telafi etmek zorunda değilsin. Düşündüğünden daha hafif başla ve oradan inşa et. Beden, sandığından fazlasını hatırlar."],
    ["Beginnings are awkward. The grip feels strange and the numbers look small. Every strong person you admire once stood exactly here.", "Начало всегда неловкое. Хват непривычный, цифры кажутся маленькими. Каждый сильный человек, которым ты восхищаешься, когда-то стоял ровно здесь.", "Başlangıçlar tuhaftır. Tutuş garip gelir, sayılar küçük görünür. Hayran olduğun her güçlü insan bir zamanlar tam burada duruyordu."],
  ]),
  ...group('consistency', [
    ["“Again” is a beautiful word.", "«Ещё раз» — красивые слова.", "“Tekrar” güzel bir kelime."],
    ["Same bar. Different you.", "Перекладина та же. Ты — уже нет.", "Bar aynı. Sen değiştin."],
    ["Rhythm beats intensity.", "Ритм важнее интенсивности.", "Ritim yoğunluktan önemlidir."],
    ["Three times a week. For years.", "Три раза в неделю. Годами.", "Haftada üç kez. Yıllarca."],
    ["Consistency isn’t never missing a day. It’s coming back after you miss one, without drama. Rest and recovery days are part of the rhythm too.", "Постоянство — это не когда ты не пропускаешь ни дня. Это когда возвращаешься после пропуска без драмы. Дни отдыха и восстановления — тоже часть ритма.", "İstikrar hiç gün kaçırmamak değildir. Bir günü kaçırdıktan sonra dram yapmadan geri dönmektir. Dinlenme ve toparlanma günleri de ritmin parçasıdır."],
    ["A perfect session once a month changes nothing. A decent session twice a week changes everything, slowly. Choose decent, and repeat it.", "Идеальная тренировка раз в месяц ничего не меняет. Нормальная тренировка дважды в неделю меняет всё — медленно. Выбирай нормальную и повторяй.", "Ayda bir yapılan kusursuz bir antrenman hiçbir şeyi değiştirmez. Haftada iki kez yapılan düzgün bir antrenman her şeyi yavaşça değiştirir. Düzgün olanı seç ve tekrarla."],
  ]),
];

export const THOUGHTS_BY_ID: ReadonlyMap<string, Thought> = new Map(THOUGHTS.map((t) => [t.id, t]));
