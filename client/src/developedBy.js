/**
 * developedBy.js — details shown on the "Developed By" tab.
 *
 * Edit this file only:
 *  - add one object per team member (photo files go in client/public/team/)
 *  - leave `photo` empty to show an initials avatar instead
 */

export const PROJECT = {
  title: 'DBMS-Laboratory',
  subtitle: 'Interactive DBMS Laboratory: Database Design, Query Processing & Transactions',
  course: 'Database Management Systems',
  year: '2026',
};

/** What makes this project different — shown as cards on the Innovation tab. */
export const INNOVATIONS = [
  {
    icon: 'lab',
    title: 'Interactive DBMS Laboratory',
    text: 'A unified interactive laboratory connecting Database Design (ER/EER modeling and relational schema mapping, 1NF to BCNF normalization), Query Processing (relational algebra query trees, heuristic pushdown optimization, B+ tree indexing), and Transactions (deadlock detection, prevention, avoidance, conflict serializability, and multi-protocol benchmarking).',
  },
  {
    icon: 'bot',
    title: 'Two tutors: offline + AI',
    text: 'A built-in offline tutor answers natural-language questions about the current run — "why did T2 abort?", "what if I used wound-wait instead?" — by reading the simulation data and re-running the engine, with no keys or network. Flip a switch and a real LLM (free-tier Gemini, Groq or OpenRouter key, or a local model) explains the same run in its own words, grounded in the offline engine\'s facts so it cannot invent transactions or steps.',
  },
  {
    icon: 'search',
    title: 'Watch the algorithm think',
    text: 'The depth-first search that detects a cycle is replayed on the graph: nodes turn purple as they are visited, edges light up as they are followed, and the cycle flashes red the moment it is found. Detection, wait-die, wound-wait and the Banker\'s algorithm all share the same scrub-anywhere step timeline.',
  },
  {
    icon: 'puzzle',
    title: 'One schedule, four strategies',
    text: 'The same lock schedule can be run under detection with four victim policies, or under wait-die and wound-wait, so students can compare how each strategy treats the identical conflict. SQL-style input (SELECT / UPDATE) is translated to shared and exclusive locks automatically.',
  },
  {
    icon: 'chart',
    title: 'History, analytics and sharing',
    text: 'Every run can be saved to SQLite, exported as a Markdown report or JSON, reopened later, or shared as a link that opens the exact step. An analytics dashboard tracks deadlock rates, game scores and the questions students ask the tutor most.',
  },
  {
    icon: 'volume',
    title: 'Accessible by design',
    text: 'Every explanation can be read aloud, the whole simulator is keyboard-driven, node states use shape as well as colour, dark and light themes are supported, and the layout works down to phone width.',
  },
];

export const TEAM = [
  {
    name: 'Prikshit Ghangas',
    register: '25BCE1870',
    photo: '/team/prikshit.jpg',          // ← put the file in client/public/team/ (or leave '' for initials)
    role: 'Developer',
  },
  {
    name: 'Purshottam Taparia',
    register: '25BCE1812',
    photo: '/team/purshottam.jpg',          // ← put the file in client/public/team/ (or leave '' for initials)
    role: 'Developer',
  },
  {
    name: 'Kanishk Ahuja',
    register: '25BCE1233',
    photo: '/team/kanishk.jpg',          // ← put the file in client/public/team/ (or leave '' for initials)
    role: 'Developer',
  },
];

export const GUIDE = {
  name: 'Joe Danith',
  title: 'Assistant Professor',
  photo: '',
};
