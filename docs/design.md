# Software Design

The software design document should be consistent with the requirements document, it should document and explain how the design will actually deliver the required features.

There is no one "right" way to create this document. Use your best judgement to choose the notations and tools. In any case, make sure that this document is meaningful with respect to your system. Be selective in what you portray about the architecture -- don’t go into too much detail but don’t make it overly superficial either. Suppose a new developer comes to the project: describe what is not obvious and definitely important to know. As for practical guidelines, each diagram should be described and motivated; you should use a consistent naming convention, and key elements should be annotated with further comments to explain their roles.

Before getting started, refresh your understanding of UML, this book is recommended (chapters 1, 3, 4): https://learning.oreilly.com/library/view/uml-distilled-a/0321193687/.

## High-level Architecture

Most likely, you will not use any UML notation for the architecture diagram. You are free to invent your own style of architecture diagram. Include a useful legend. Refer to the examples discussed in class for guidance.

What’s the right scope of the architecture diagram? “One that’s big enough to be meaningful, small enough to be comprehensible, and cohesive enough to make sense.” Study this chapter to feel the gist of creating good software architecture diagrams: Make sure that your diagram includes all layers.

You can have more than one diagram if your project’s complexity requires it.

## UML Class Diagram

Major data elements -> If you adopt an object-oriented style for your system, you can present the data as a UML Class diagram.

If your system is not naturally object-oriented, you can create an Entity Relationship diagram (ERD).

## Sequence Diagrams

Interaction scenarios -> To document the dynamic behaviour of the system, for each interesting feature, you should develop a UML Sequence diagram, with components as “objects” and calls between them. Think, which features of your system should be described as sequence diagrams.

## Low-fidelity Wireframes

Finally, you should develop low-fidelity sketches/wireframes of a few key screens. At this stage, it’s important to show the overall look and feel of your app, as well as the high-level user-interaction design. Low-fidelity wireframes are usually black and white.

Looking at the wireframes, anyone should be able to get an idea of what will be developed. Test your wireframes with your client, encourage them to give feedback.

## Tech Stack 

List the possible tech stack you will be using. Include links and descriptions of any libraries, frameworks, and tools you will be using.