/**
 * Compact dictionaries used by the heuristic entity detector. They trade recall
 * for size: the goal is to catch the common case in the browser without a
 * model download. See /privacy for documented limitations.
 */

const toSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

/** Common given names across many locales (lower-cased). */
export const FIRST_NAMES = toSet(`
aaron abby abdul abigail adam adrian adriana agnes ahmed aidan aiden aisha alan albert alex alexa alexander alexandra alexis
alfie ali alice alicia alison amanda amber amelia amir amy ana andre andrea andrew andy angela angelo anita ann anna anne annie
anthony antonio aoife arjun arthur ashley aurora austin ava barbara barry beatrice ben benjamin bernard beth bethany bianca bob
bobby brandon brendan brian bridget brooke bruce bryan caitlin caleb calum cameron camila carl carla carlos carmen carol caroline
catherine cathal charles charlie charlotte chen chloe chris christian christina christine christopher ciara cian ciaran claire
clara colin conor connor craig cristina dan daniel daniela danielle darragh dave david dean deborah declan denis dennis derek
diana diego dimitri dmitri dominic donal donna doris dorothy dylan eamon edward eileen elena eli elijah elizabeth ella ellen
ellie emeka emily emma eoin eric erica erin ethan eva evan evelyn fatima felix fernando finn fiona francesca francis frank
fred freya gabriel gabriela gareth gary gavin george georgia gerald gerard gianna gillian giulia giuseppe grace graham greg
gregory hailey hannah harry harvey hassan hector helen henry hiroshi hugo ian ibrahim imogen ines irene isaac isabel isabella
isla ivan jack jacob jade james jamie jan jane janet jason javier jayden jean jennifer jenny jeremy jessica jim jimmy joan
joanna joe joel john johnny jonathan jordan jorge jose joseph josh joshua juan julia julian julie justin karen kate katherine
kathleen katie kayla keith kelly ken kenji kevin kieran kim kyle laura lauren layla leah lee leo leon liam lily linda lisa
lorenzo louis louise lucas lucia lucy luis luka luke lydia madison maeve maria mariam marie marina mario marta martin mary
mason matteo matthew maya megan mehmet mei melissa mia michael michelle miguel mike mila milan mohamed mohammed muhammad
nadia naomi natalie nathan neil niamh nicholas nick nicola nicole nikhil nina noah noel nora oisin olga oliver olivia omar
oscar owen padraig pablo pamela patricia patrick paul paula pedro peter philip phoebe pierre pooja priya rachel rahul raj
ramon rebecca rhys ricardo richard rob robert roberto robin rohan roisin ronan rory rosa ruth ryan sadie sam samantha samuel
sandra sara sarah sasha scarlett sean sebastian sergei seamus shane sharon shauna sinead siobhan sofia sophia sophie stella
stephen steve steven stuart susan suzanne tara teresa thomas tim timothy tom tomas tommy tony tyler valentina vanessa victor
victoria vikram vincent wei william xavier yara yasmin yusuf zach zachary zara zoe
`);

/** Given names that are also common English words; only matched with a person cue or surname. */
export const AMBIGUOUS_NAMES = toSet(`
april art bill dawn eve faith frank grace hope ivy jack jade joy june mark may max miles pat rose ruby sky summer will
`);

export const CITIES = toSet(`
abidjan abu-dhabi accra addis-ababa adelaide ahmedabad algiers almaty amman amsterdam ankara antwerp athens atlanta auckland
austin baghdad baku bangalore bangkok barcelona basel beijing beirut belfast belgrade bengaluru berlin bern birmingham bogota
bologna bordeaux boston bratislava brisbane bristol brussels bucharest budapest buenos-aires cairo calgary cambridge canberra
cape-town caracas cardiff casablanca chennai chicago cologne copenhagen cork dakar dallas damascus delhi denver detroit dhaka
doha dortmund dubai dublin durban dusseldorf edinburgh eindhoven florence frankfurt galway geneva genoa glasgow gothenburg
guadalajara guangzhou hamburg hanoi hanover harare havana helsinki hong-kong honolulu houston hyderabad istanbul jakarta
jerusalem johannesburg karachi kathmandu kiev kigali kilkenny kingston kolkata krakow kuala-lumpur kyiv kyoto lagos lahore
las-vegas leeds leipzig lima limerick lisbon liverpool ljubljana london los-angeles luxembourg lyon madrid malaga manchester
manila marseille medellin melbourne mexico-city miami milan minneapolis minsk monaco montevideo montreal moscow mumbai munich
nairobi nantes naples nashville new-delhi new-orleans new-york osaka oslo ottawa oxford palermo paris perth philadelphia
phoenix porto portland prague pune quebec quito rabat reykjavik riga rio-de-janeiro riyadh rome rotterdam saint-petersburg
salzburg san-diego san-francisco san-jose santiago sao-paulo sarajevo seattle seoul seville shanghai shenzhen singapore sofia
stockholm strasbourg stuttgart sydney taipei tallinn tampa tbilisi tehran tel-aviv the-hague tirana tokyo toronto toulouse
tunis turin utrecht valencia vancouver venice vienna vilnius warsaw washington waterford wellington wroclaw yerevan zagreb
zurich
`);

export const COUNTRIES = toSet(`
afghanistan albania algeria argentina armenia australia austria azerbaijan bangladesh belarus belgium bolivia bosnia brazil
bulgaria cambodia cameroon canada chile china colombia croatia cuba cyprus czechia denmark ecuador egypt england estonia
ethiopia finland france georgia germany ghana greece hungary iceland india indonesia iran iraq ireland israel italy jamaica
japan jordan kazakhstan kenya korea kosovo latvia lebanon lithuania luxembourg malaysia malta mexico moldova mongolia
montenegro morocco nepal netherlands nigeria norway pakistan panama paraguay peru philippines poland portugal qatar romania
russia rwanda scotland senegal serbia singapore slovakia slovenia somalia spain sweden switzerland syria taiwan tanzania
thailand tunisia turkey uganda ukraine uruguay uzbekistan venezuela vietnam wales yemen zambia zimbabwe
`);

/**
 * Capitalized tokens that are not personal identifiers on their own: function
 * words, calendar names, languages, well-known products and crypto tickers.
 */
export const COMMON_CAPITALIZED = toSet(`
i i'm i've i'd i'll a an the this that these those my your our their his her its it we you they he she me us them
please thanks thank hi hello hey dear yes no ok okay what when where why how who whom which whose can could would should
will shall may might must do does did is are was were be been being have has had if and but or nor so then also just
not now here there today tomorrow yesterday find send show tell write make give get help explain prepare translate
summarize summarise list create draft compare check book plan buy sell swap transfer pay review fix add remove update
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september
october november december christmas easter halloween
english irish french german spanish italian portuguese dutch polish russian chinese japanese korean arabic hindi
american british european african asian australian canadian mexican indian
ai api apis sdk llm gpt claude gemini deepseek qwen kimi llama mistral openai anthropic google apple microsoft amazon
meta netflix youtube twitter x telegram discord github gitlab reddit linkedin whatsapp signal slack notion figma
solana sol usdc usdt usd eur gbp btc bitcoin eth ethereum base phantom solflare backpack pump pumpswap jupiter raydium
mr mrs ms dr prof sir madam
north south east west central new old great upper lower saint st
street road avenue lane
`);

export const PERSON_RELATIONS = [
  "wife", "husband", "partner", "spouse", "son", "daughter", "mother", "mom", "mum", "father", "dad", "brother", "sister",
  "friend", "boss", "colleague", "coworker", "manager", "doctor", "dentist", "lawyer", "landlord", "landlady", "tenant",
  "girlfriend", "boyfriend", "fiance", "fiancee", "neighbor", "neighbour", "cousin", "aunt", "uncle", "grandmother",
  "grandfather", "grandma", "grandpa", "niece", "nephew", "kid", "child", "teacher", "student", "client", "therapist",
  "roommate", "flatmate", "ex",
];

export const STREET_SUFFIXES = [
  "Street", "St", "Road", "Rd", "Avenue", "Ave", "Lane", "Ln", "Boulevard", "Blvd", "Drive", "Dr", "Court", "Ct",
  "Place", "Pl", "Square", "Sq", "Terrace", "Way", "Close", "Crescent", "Park", "Parade", "Quay", "Row", "Hill",
  "Gardens", "Grove", "Walk", "Mews", "Green", "Heights",
];

export const ORG_SUFFIXES = [
  "Inc", "Ltd", "LLC", "GmbH", "PLC", "Corp", "Corporation", "Limited", "AG", "SA", "BV", "LLP", "Group", "Holdings",
  "Bank", "University", "College", "Hospital", "Clinic", "School", "Labs", "Technologies", "Partners",
];
