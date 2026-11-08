export type TargetWord = { word: string; fr: string; example: string };

export type Scenario = {
  id: string;
  day: number;
  theme: string;
  title: string; // Spanish, shown to the learner
  titleFr: string;
  taskGoal: string; // in French, read to the tutor
  persona: string; // who the tutor plays during the task
  focus: string;
  level: "A1" | "A2" | "B1";
  words: TargetWord[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "presentarse", day: 1, theme: "Vie quotidienne", level: "A1",
    title: "Presentarse", titleFr: "Se présenter",
    taskGoal: "Se présenter : nom, pays, ville, métier, langues parlées.",
    persona: "Lucía, une nouvelle amie rencontrée à Madrid",
    focus: "ser, llamarse, vivir",
    words: [
      { word: "me llamo", fr: "je m'appelle", example: "Me llamo Sara." },
      { word: "soy de", fr: "je suis de (origine)", example: "Soy de Túnez." },
      { word: "vivo en", fr: "j'habite à", example: "Vivo en Lyon." },
      { word: "trabajo como", fr: "je travaille comme", example: "Trabajo como farmacéutica." },
      { word: "encantada", fr: "enchantée", example: "Encantada de conocerte." },
    ],
  },
  {
    id: "familia", day: 2, theme: "Vie quotidienne", level: "A1",
    title: "Mi familia y mis amigos", titleFr: "Ma famille et mes amis",
    taskGoal: "Décrire sa famille et un ami proche : qui, âge, où ils habitent.",
    persona: "Lucía, curieuse de connaître sa famille",
    focus: "tener, mi/tu/su",
    words: [
      { word: "tengo", fr: "j'ai", example: "Tengo dos hermanos." },
      { word: "el hermano / la hermana", fr: "le frère / la sœur", example: "Mi hermana vive en Túnez." },
      { word: "los padres", fr: "les parents", example: "Mis padres son muy simpáticos." },
      { word: "mi mejor amiga", fr: "ma meilleure amie", example: "Mi mejor amiga se llama Ines." },
      { word: "años", fr: "ans", example: "Tiene treinta años." },
    ],
  },
  {
    id: "rutina", day: 3, theme: "Vie quotidienne", level: "A1",
    title: "Mi día normal", titleFr: "Ma journée type",
    taskGoal: "Raconter sa journée type avec les heures : lever, travail, repas, coucher.",
    persona: "Lucía, qui compare sa routine avec la sienne",
    focus: "verbes pronominaux, la hora",
    words: [
      { word: "me levanto", fr: "je me lève", example: "Me levanto a las siete." },
      { word: "desayuno", fr: "je prends le petit-déjeuner", example: "Desayuno un café." },
      { word: "a las ocho", fr: "à huit heures", example: "Empiezo a trabajar a las ocho." },
      { word: "por la tarde", fr: "l'après-midi", example: "Por la tarde voy al gimnasio." },
      { word: "me acuesto", fr: "je me couche", example: "Me acuesto a las once." },
    ],
  },
  {
    id: "bar", day: 4, theme: "Madrid", level: "A1",
    title: "En el bar", titleFr: "Au bar",
    taskGoal: "Commander un café et quelque chose à manger, puis demander l'addition.",
    persona: "un serveur sympathique dans un bar de Madrid",
    focus: "quiero, ¿me pone…?, la cuenta",
    words: [
      { word: "¿me pone…?", fr: "vous me servez… ? (commander)", example: "¿Me pone un café con leche?" },
      { word: "un café con leche", fr: "un café au lait", example: "Un café con leche, por favor." },
      { word: "una tostada", fr: "une tartine grillée", example: "Y una tostada con tomate." },
      { word: "la cuenta", fr: "l'addition", example: "La cuenta, por favor." },
      { word: "¿cuánto es?", fr: "c'est combien ?", example: "¿Cuánto es todo?" },
    ],
  },
  {
    id: "comida", day: 5, theme: "Vie quotidienne", level: "A1",
    title: "La comida", titleFr: "La nourriture",
    taskGoal: "Dire ce qu'elle aime et n'aime pas manger, et son plat préféré.",
    persona: "Lucía, qui adore cuisiner",
    focus: "gustar, encantar",
    words: [
      { word: "me gusta", fr: "j'aime (une chose)", example: "Me gusta el pescado." },
      { word: "me gustan", fr: "j'aime (plusieurs choses)", example: "Me gustan las fresas." },
      { word: "me encanta", fr: "j'adore", example: "Me encanta la tortilla." },
      { word: "no me gusta nada", fr: "je n'aime pas du tout", example: "No me gusta nada el picante." },
      { word: "mi plato favorito", fr: "mon plat préféré", example: "Mi plato favorito es el cuscús." },
    ],
  },
  {
    id: "trabajo", day: 6, theme: "Travail", level: "A1",
    title: "Mi trabajo: soy farmacéutica", titleFr: "Mon travail",
    taskGoal: "Expliquer son métier de pharmacienne : où, horaires, ce qu'elle fait, ce qu'elle aime.",
    persona: "Lucía, qui ne connaît pas le métier de pharmacienne",
    focus: "ser/estar, trabajar en",
    words: [
      { word: "la farmacia", fr: "la pharmacie", example: "Trabajo en una farmacia." },
      { word: "los clientes", fr: "les clients", example: "Hablo con los clientes." },
      { word: "el medicamento", fr: "le médicament", example: "Explico el medicamento." },
      { word: "estoy cansada", fr: "je suis fatiguée (état)", example: "Por la noche estoy cansada." },
      { word: "me gusta mi trabajo", fr: "j'aime mon travail", example: "Me gusta mi trabajo porque ayudo." },
    ],
  },
  {
    id: "repaso-1", day: 7, theme: "Révision", level: "A1",
    title: "Repaso: mi semana", titleFr: "Révision : ma semaine",
    taskGoal: "Conversation libre pour réutiliser les mots des jours 1 à 6.",
    persona: "Lucía, une amie qui prend des nouvelles",
    focus: "révision",
    words: [
      { word: "esta semana", fr: "cette semaine", example: "Esta semana trabajo mucho." },
      { word: "también", fr: "aussi", example: "Yo también." },
      { word: "pero", fr: "mais", example: "Me gusta, pero es caro." },
      { word: "porque", fr: "parce que", example: "Estoy feliz porque es viernes." },
      { word: "¿y tú?", fr: "et toi ?", example: "Estoy bien, ¿y tú?" },
    ],
  },
  {
    id: "supermercado", day: 8, theme: "Madrid", level: "A1",
    title: "En el mercado", titleFr: "Au marché",
    taskGoal: "Acheter des fruits et légumes : quantités, prix, payer.",
    persona: "une vendeuse au marché de San Miguel",
    focus: "cantidades, precios, números",
    words: [
      { word: "un kilo de", fr: "un kilo de", example: "Un kilo de tomates, por favor." },
      { word: "medio kilo", fr: "un demi-kilo", example: "Medio kilo de fresas." },
      { word: "¿algo más?", fr: "autre chose ?", example: "¿Algo más? No, gracias." },
      { word: "euros", fr: "euros", example: "Son tres euros." },
      { word: "con tarjeta", fr: "par carte", example: "¿Puedo pagar con tarjeta?" },
    ],
  },
  {
    id: "casa", day: 9, theme: "Vie quotidienne", level: "A1",
    title: "Mi casa y mi barrio", titleFr: "Mon logement et mon quartier",
    taskGoal: "Décrire son appartement et ce qu'il y a dans son quartier.",
    persona: "Lucía, qui cherche un appartement",
    focus: "hay, estar (lieu)",
    words: [
      { word: "hay", fr: "il y a", example: "Hay un parque cerca." },
      { word: "el piso", fr: "l'appartement", example: "Mi piso es pequeño." },
      { word: "está cerca de", fr: "c'est près de", example: "Está cerca del metro." },
      { word: "la habitación", fr: "la chambre", example: "Tiene dos habitaciones." },
      { word: "el barrio", fr: "le quartier", example: "Mi barrio es tranquilo." },
    ],
  },
  {
    id: "fin-de-semana", day: 10, theme: "Vie quotidienne", level: "A1",
    title: "Planes para el fin de semana", titleFr: "Projets du week-end",
    taskGoal: "Parler de ses projets du week-end avec 'ir a + infinitif'.",
    persona: "Lucía, qui propose des idées de sorties",
    focus: "ir a + infinitivo",
    words: [
      { word: "voy a", fr: "je vais (+ infinitif)", example: "Voy a descansar." },
      { word: "el sábado", fr: "samedi", example: "El sábado voy a ir al cine." },
      { word: "con mi novio", fr: "avec mon copain", example: "Voy a cenar con mi novio." },
      { word: "dar un paseo", fr: "se promener", example: "Vamos a dar un paseo por el Retiro." },
      { word: "quedarse en casa", fr: "rester à la maison", example: "El domingo me quedo en casa." },
    ],
  },
  {
    id: "farmacia-cliente", day: 11, theme: "Travail", level: "A2",
    title: "En la farmacia: un cliente", titleFr: "À la pharmacie : un client",
    taskGoal: "Jouer la pharmacienne : un client a mal à la tête, elle pose des questions et conseille.",
    persona: "un client qui a mal à la tête (Lucía joue le client)",
    focus: "doler, tener que",
    words: [
      { word: "me duele la cabeza", fr: "j'ai mal à la tête", example: "Me duele mucho la cabeza." },
      { word: "¿desde cuándo?", fr: "depuis quand ?", example: "¿Desde cuándo le duele?" },
      { word: "tiene que", fr: "vous devez", example: "Tiene que beber agua." },
      { word: "cada ocho horas", fr: "toutes les huit heures", example: "Una pastilla cada ocho horas." },
      { word: "la receta", fr: "l'ordonnance", example: "¿Tiene receta?" },
    ],
  },
  {
    id: "tiempo-ropa", day: 12, theme: "Vie quotidienne", level: "A1",
    title: "El tiempo y la ropa", titleFr: "La météo et les vêtements",
    taskGoal: "Parler de la météo aujourd'hui et de ce qu'elle porte selon le temps.",
    persona: "Lucía, qui prépare une valise pour Madrid",
    focus: "hace calor/frío, llevar",
    words: [
      { word: "hace frío", fr: "il fait froid", example: "Hoy hace frío." },
      { word: "hace calor", fr: "il fait chaud", example: "En agosto hace mucho calor." },
      { word: "llueve", fr: "il pleut", example: "En Lyon llueve mucho." },
      { word: "llevo", fr: "je porte", example: "Llevo un abrigo." },
      { word: "el abrigo", fr: "le manteau", example: "Necesito un abrigo." },
    ],
  },
  {
    id: "quedar", day: 13, theme: "Madrid", level: "A1",
    title: "Quedar con amigos", titleFr: "Donner rendez-vous à des amis",
    taskGoal: "Organiser une sortie : proposer, choisir le jour, l'heure et le lieu.",
    persona: "une amie madrilène qui veut sortir",
    focus: "¿quedamos…?, ¿a qué hora?",
    words: [
      { word: "¿quedamos?", fr: "on se voit ?", example: "¿Quedamos el viernes?" },
      { word: "¿a qué hora?", fr: "à quelle heure ?", example: "¿A qué hora quedamos?" },
      { word: "vale", fr: "d'accord", example: "Vale, perfecto." },
      { word: "me viene bien", fr: "ça m'arrange", example: "El sábado me viene bien." },
      { word: "nos vemos", fr: "à plus / on se voit", example: "Nos vemos en Sol." },
    ],
  },
  {
    id: "repaso-2", day: 14, theme: "Révision", level: "A1",
    title: "Repaso: contar mi semana", titleFr: "Révision : raconter ma semaine",
    taskGoal: "Conversation libre pour réutiliser les mots des jours 8 à 13.",
    persona: "Lucía, une amie qui prend des nouvelles",
    focus: "révision",
    words: [
      { word: "normalmente", fr: "d'habitude", example: "Normalmente trabajo por la mañana." },
      { word: "a veces", fr: "parfois", example: "A veces voy al mercado." },
      { word: "luego", fr: "ensuite", example: "Luego como con mis amigas." },
      { word: "¡qué bien!", fr: "super !", example: "¡Qué bien! Me alegro." },
      { word: "creo que", fr: "je pense que", example: "Creo que es buena idea." },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
