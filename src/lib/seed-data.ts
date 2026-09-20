/* Built-in library seed.
   ----------------------------------------------------------------------------
   The tracker is course-agnostic: a student picks their own university,
   course and semester at signup. Only one sample library ships pre-populated
   (GTU BCA, Semester 3) so the app is not empty on first run; every other
   course/semester is intentional-empty and grows from what students scan or
   type in via the Library. */

export type SeedTopic = { title: string; weightage: number; difficulty?: number; estMinutes?: number };
export type SeedUnit = { number: number; title: string; weightage: number; topics: SeedTopic[] };
export type SeedSubject = {
  name: string;
  code: string;
  credits: number;
  color: string;
  icon: string;
  units: SeedUnit[];
};

/** supported range — covers 3-year (6 sem) and 4-year (8 sem) programs */
export const MIN_SEMESTER = 1;
export const MAX_SEMESTER = 8;

export const SEMESTERS = Array.from({ length: MAX_SEMESTER }, (_, i) => ({
  number: i + 1,
  name: `Semester ${i + 1}`,
}));

export const SEM3: SeedSubject[] = [
  {
    name: "OOP with Java",
    code: "4330701",
    credits: 5,
    color: "orange",
    icon: "code",
    units: [
      {
        number: 1,
        title: "Java Fundamentals",
        weightage: 12,
        topics: [
          { title: "Features of Java, JVM / JRE / JDK", weightage: 3, difficulty: 1 },
          { title: "Data types, variables and operators", weightage: 3, difficulty: 1 },
          { title: "Control statements and loops", weightage: 3, difficulty: 1 },
          { title: "Arrays and command-line arguments", weightage: 3, difficulty: 2 },
        ],
      },
      {
        number: 2,
        title: "Classes, Objects and Methods",
        weightage: 16,
        topics: [
          { title: "Class, object, constructor overloading", weightage: 4, difficulty: 2 },
          { title: "this, static and final keywords", weightage: 3, difficulty: 2 },
          { title: "Inheritance and method overriding", weightage: 5, difficulty: 3 },
          { title: "Abstract classes and interfaces", weightage: 4, difficulty: 3 },
        ],
      },
      {
        number: 3,
        title: "Packages and Exception Handling",
        weightage: 14,
        topics: [
          { title: "Creating and importing packages", weightage: 3, difficulty: 2 },
          { title: "Access modifiers", weightage: 3, difficulty: 1 },
          { title: "try / catch / finally, throw and throws", weightage: 4, difficulty: 2 },
          { title: "User-defined exceptions", weightage: 4, difficulty: 3 },
        ],
      },
      {
        number: 4,
        title: "Multithreading and Strings",
        weightage: 14,
        topics: [
          { title: "Thread lifecycle, Thread class vs Runnable", weightage: 5, difficulty: 3 },
          { title: "Thread priority and synchronization", weightage: 4, difficulty: 3 },
          { title: "String, StringBuffer, StringBuilder", weightage: 3, difficulty: 2 },
          { title: "Wrapper classes and autoboxing", weightage: 2, difficulty: 1 },
        ],
      },
      {
        number: 5,
        title: "Collections, I/O and JDBC",
        weightage: 14,
        topics: [
          { title: "Collection framework: List, Set, Map", weightage: 5, difficulty: 3 },
          { title: "File handling with streams", weightage: 3, difficulty: 2 },
          { title: "JDBC connectivity steps", weightage: 4, difficulty: 3 },
          { title: "Applet / AWT basics", weightage: 2, difficulty: 1 },
        ],
      },
    ],
  },
  {
    name: "Computer Networks",
    code: "4330702",
    credits: 4,
    color: "blue",
    icon: "network",
    units: [
      {
        number: 1,
        title: "Introduction to Networking",
        weightage: 12,
        topics: [
          { title: "Network types: LAN, MAN, WAN, PAN", weightage: 3, difficulty: 1 },
          { title: "Topologies and their trade-offs", weightage: 3, difficulty: 1 },
          { title: "Transmission media: guided and unguided", weightage: 3, difficulty: 2 },
          { title: "Network devices: hub, switch, router, gateway", weightage: 3, difficulty: 2 },
        ],
      },
      {
        number: 2,
        title: "Reference Models",
        weightage: 16,
        topics: [
          { title: "OSI model — seven layers and functions", weightage: 6, difficulty: 2 },
          { title: "TCP/IP model and comparison with OSI", weightage: 5, difficulty: 2 },
          { title: "Encapsulation and de-encapsulation", weightage: 3, difficulty: 3 },
          { title: "Protocols and standards bodies", weightage: 2, difficulty: 1 },
        ],
      },
      {
        number: 3,
        title: "Data Link and MAC",
        weightage: 14,
        topics: [
          { title: "Framing and error detection (CRC, checksum)", weightage: 5, difficulty: 3 },
          { title: "Flow control: stop-and-wait, sliding window", weightage: 4, difficulty: 3 },
          { title: "CSMA/CD and CSMA/CA", weightage: 3, difficulty: 2 },
          { title: "Ethernet standards", weightage: 2, difficulty: 1 },
        ],
      },
      {
        number: 4,
        title: "Network Layer and Addressing",
        weightage: 16,
        topics: [
          { title: "IPv4 addressing and classes", weightage: 4, difficulty: 2 },
          { title: "Subnetting and CIDR problems", weightage: 6, difficulty: 3 },
          { title: "Routing algorithms: distance vector, link state", weightage: 4, difficulty: 3 },
          { title: "IPv6 basics and NAT", weightage: 2, difficulty: 2 },
        ],
      },
      {
        number: 5,
        title: "Transport and Application Layer",
        weightage: 12,
        topics: [
          { title: "TCP vs UDP, three-way handshake", weightage: 4, difficulty: 2 },
          { title: "Ports and sockets", weightage: 2, difficulty: 1 },
          { title: "DNS, DHCP, HTTP, FTP, SMTP", weightage: 4, difficulty: 2 },
          { title: "Network security basics and firewalls", weightage: 2, difficulty: 2 },
        ],
      },
    ],
  },
  {
    name: "Operating System",
    code: "4330703",
    credits: 4,
    color: "purple",
    icon: "chip",
    units: [
      {
        number: 1,
        title: "OS Overview",
        weightage: 12,
        topics: [
          { title: "Functions and types of operating systems", weightage: 4, difficulty: 1 },
          { title: "System calls and OS structure", weightage: 4, difficulty: 2 },
          { title: "Kernel, shell and boot process", weightage: 4, difficulty: 2 },
        ],
      },
      {
        number: 2,
        title: "Process Management",
        weightage: 18,
        topics: [
          { title: "Process states and PCB", weightage: 4, difficulty: 2 },
          { title: "CPU scheduling: FCFS, SJF, Round Robin", weightage: 7, difficulty: 3 },
          { title: "Priority scheduling and starvation", weightage: 4, difficulty: 3 },
          { title: "Threads and context switching", weightage: 3, difficulty: 2 },
        ],
      },
      {
        number: 3,
        title: "Synchronization and Deadlock",
        weightage: 16,
        topics: [
          { title: "Critical section problem and semaphores", weightage: 5, difficulty: 3 },
          { title: "Producer–consumer and reader–writer", weightage: 4, difficulty: 3 },
          { title: "Deadlock conditions and prevention", weightage: 4, difficulty: 3 },
          { title: "Banker's algorithm", weightage: 3, difficulty: 3 },
        ],
      },
      {
        number: 4,
        title: "Memory Management",
        weightage: 14,
        topics: [
          { title: "Contiguous allocation, fragmentation", weightage: 3, difficulty: 2 },
          { title: "Paging and segmentation", weightage: 5, difficulty: 3 },
          { title: "Virtual memory and demand paging", weightage: 3, difficulty: 3 },
          { title: "Page replacement: FIFO, LRU, Optimal", weightage: 3, difficulty: 3 },
        ],
      },
      {
        number: 5,
        title: "File and Device Management",
        weightage: 10,
        topics: [
          { title: "File allocation methods and directories", weightage: 4, difficulty: 2 },
          { title: "Disk scheduling: SCAN, C-SCAN, SSTF", weightage: 4, difficulty: 3 },
          { title: "Linux basic commands", weightage: 2, difficulty: 1 },
        ],
      },
    ],
  },
  {
    name: "Design Thinking & Innovation",
    code: "4330704",
    credits: 3,
    color: "pink",
    icon: "spark",
    units: [
      {
        number: 1,
        title: "Introduction to Design Thinking",
        weightage: 14,
        topics: [
          { title: "What is design thinking, history and need", weightage: 5, difficulty: 1 },
          { title: "Human-centred design principles", weightage: 5, difficulty: 2 },
          { title: "Case studies of design-led products", weightage: 4, difficulty: 1 },
        ],
      },
      {
        number: 2,
        title: "Empathize and Define",
        weightage: 16,
        topics: [
          { title: "User research, interviews, observation", weightage: 5, difficulty: 2 },
          { title: "Empathy map and persona building", weightage: 6, difficulty: 2 },
          { title: "Problem statement and point of view", weightage: 5, difficulty: 2 },
        ],
      },
      {
        number: 3,
        title: "Ideate",
        weightage: 14,
        topics: [
          { title: "Brainstorming, SCAMPER, mind mapping", weightage: 6, difficulty: 2 },
          { title: "Idea selection and feasibility matrix", weightage: 4, difficulty: 2 },
          { title: "Creative thinking blocks", weightage: 4, difficulty: 1 },
        ],
      },
      {
        number: 4,
        title: "Prototype and Test",
        weightage: 16,
        topics: [
          { title: "Low-fidelity vs high-fidelity prototypes", weightage: 6, difficulty: 2 },
          { title: "Usability testing and feedback loop", weightage: 6, difficulty: 2 },
          { title: "Iteration and pivot", weightage: 4, difficulty: 2 },
        ],
      },
      {
        number: 5,
        title: "Innovation and Entrepreneurship",
        weightage: 10,
        topics: [
          { title: "Business model canvas", weightage: 5, difficulty: 2 },
          { title: "IPR, patents and startup ecosystem", weightage: 5, difficulty: 2 },
        ],
      },
    ],
  },
  {
    name: "Vision Controlling",
    code: "4330705",
    credits: 3,
    color: "teal",
    icon: "eye",
    units: [
      {
        number: 1,
        title: "Vision Systems Basics",
        weightage: 14,
        topics: [
          { title: "Machine vision: components and applications", weightage: 5, difficulty: 2 },
          { title: "Image formation, pixels, resolution", weightage: 5, difficulty: 2 },
          { title: "Camera types, lenses and lighting", weightage: 4, difficulty: 2 },
        ],
      },
      {
        number: 2,
        title: "Image Processing Fundamentals",
        weightage: 16,
        topics: [
          { title: "Grayscale, thresholding, histogram", weightage: 5, difficulty: 2 },
          { title: "Filtering, smoothing and sharpening", weightage: 6, difficulty: 3 },
          { title: "Morphological operations", weightage: 5, difficulty: 3 },
        ],
      },
      {
        number: 3,
        title: "Feature Detection",
        weightage: 14,
        topics: [
          { title: "Edge detection: Sobel, Canny", weightage: 6, difficulty: 3 },
          { title: "Contours, blobs and shape analysis", weightage: 4, difficulty: 3 },
          { title: "Template matching", weightage: 4, difficulty: 2 },
        ],
      },
      {
        number: 4,
        title: "Vision Based Control",
        weightage: 16,
        topics: [
          { title: "Visual servoing basics", weightage: 6, difficulty: 3 },
          { title: "Object tracking and motion detection", weightage: 6, difficulty: 3 },
          { title: "Calibration and coordinate transforms", weightage: 4, difficulty: 3 },
        ],
      },
      {
        number: 5,
        title: "Applications and Tools",
        weightage: 10,
        topics: [
          { title: "OpenCV workflow and practicals", weightage: 5, difficulty: 2 },
          { title: "Industrial inspection case studies", weightage: 5, difficulty: 1 },
        ],
      },
    ],
  },
  {
    name: "Mathematics",
    code: "4330706",
    credits: 4,
    color: "indigo",
    icon: "sigma",
    units: [
      {
        number: 1,
        title: "Matrices and Determinants",
        weightage: 14,
        topics: [
          { title: "Types of matrices, operations", weightage: 3, difficulty: 1 },
          { title: "Determinant, minor, cofactor", weightage: 4, difficulty: 2 },
          { title: "Inverse and rank of a matrix", weightage: 4, difficulty: 3 },
          { title: "System of linear equations", weightage: 3, difficulty: 3 },
        ],
      },
      {
        number: 2,
        title: "Differential Calculus",
        weightage: 16,
        topics: [
          { title: "Limits and continuity", weightage: 4, difficulty: 2 },
          { title: "Derivatives and rules of differentiation", weightage: 5, difficulty: 2 },
          { title: "Maxima, minima and applications", weightage: 4, difficulty: 3 },
          { title: "Partial derivatives", weightage: 3, difficulty: 3 },
        ],
      },
      {
        number: 3,
        title: "Integral Calculus",
        weightage: 14,
        topics: [
          { title: "Indefinite integrals and methods", weightage: 5, difficulty: 3 },
          { title: "Definite integrals and properties", weightage: 5, difficulty: 3 },
          { title: "Area under a curve", weightage: 4, difficulty: 2 },
        ],
      },
      {
        number: 4,
        title: "Statistics and Probability",
        weightage: 16,
        topics: [
          { title: "Mean, median, mode, standard deviation", weightage: 5, difficulty: 1 },
          { title: "Correlation and regression", weightage: 5, difficulty: 3 },
          { title: "Probability rules and Bayes theorem", weightage: 6, difficulty: 3 },
        ],
      },
      {
        number: 5,
        title: "Discrete Mathematics",
        weightage: 10,
        topics: [
          { title: "Sets, relations and functions", weightage: 4, difficulty: 2 },
          { title: "Logic, truth tables and proofs", weightage: 3, difficulty: 2 },
          { title: "Graph theory basics", weightage: 3, difficulty: 3 },
        ],
      },
    ],
  },
];
