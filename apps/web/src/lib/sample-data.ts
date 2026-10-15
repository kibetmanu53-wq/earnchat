export interface SampleMessage {
  from: 'them' | 'you';
  text: string;
  time: string;
}

export interface SamplePerson {
  id: string;
  name: string;
  initials: string;
  topic: string;
  color: string;
  messages: SampleMessage[];
}

export const PEOPLE: SamplePerson[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    initials: 'MC',
    topic: 'Portland, OR',
    color: '#c7dbbf',
    messages: [
      { from: 'them', text: 'Hey! I saw you’re into weekend hikes. Planning a trip to the coast soon.', time: '10:36' },
      { from: 'you', text: 'That sounds like a plan! Have you tried the trails around Cape Lookout?', time: '10:38' },
      { from: 'them', text: 'Not yet, but it’s on the list. A little intimidated by the distance though!', time: '10:42' }
    ]
  },
  {
    id: 'jon',
    name: 'Jon Bell',
    initials: 'JB',
    topic: 'Austin, TX',
    color: '#dedafd',
    messages: [
      { from: 'them', text: 'Thanks for picking up. What have you been listening to lately?', time: 'Yesterday' },
      { from: 'you', text: 'Lots of mellow indie and jazz this week.', time: 'Yesterday' }
    ]
  },
  {
    id: 'priya',
    name: 'Priya Shah',
    initials: 'PS',
    topic: 'London, UK',
    color: '#f7d3a8',
    messages: [
      { from: 'them', text: 'Taking a break from work and would love a little company.', time: 'Sun' },
      { from: 'you', text: 'A slow afternoon sounds lovely right now.', time: 'Sun' }
    ]
  },
  {
    id: 'eli',
    name: 'Eli Santos',
    initials: 'ES',
    topic: 'Toronto, CA',
    color: '#c9e3e4',
    messages: [
      { from: 'them', text: 'How did your interview go?', time: 'Sat' },
      { from: 'you', text: 'It went really well — excited to keep moving forward.', time: 'Sat' }
    ]
  }
];

export function findPerson(id: string): SamplePerson | null {
  return PEOPLE.find((person) => person.id === id) ?? null;
}
