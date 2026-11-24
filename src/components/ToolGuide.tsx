import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface GuideSection {
  heading: string;
  body: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolGuideProps {
  title: string;
  intro: string;
  sections: GuideSection[];
  tips: string[];
  faqs: FaqItem[];
}

export const ToolGuide: React.FC<ToolGuideProps> = ({
  title,
  intro,
  sections,
  tips,
  faqs,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section
      aria-labelledby="guide-heading"
      className="mt-10 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-8"
    >
      <div className="max-w-3xl space-y-3">
        <h2
          id="guide-heading"
          className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance"
        >
          {title}
        </h2>
        <p className="text-base text-slate-600 leading-relaxed">{intro}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-slate-100">
        {sections.map((section) => (
          <article key={section.heading} className="space-y-2">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              {section.heading}
            </h3>
            <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">
              {section.body}
            </p>
          </article>
        ))}
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-5 space-y-3">
        <h3 className="font-display text-base font-semibold text-slate-900">
          Quick Best Practices
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700 list-disc pl-5">
          {tips.map((tip) => (
            <li key={tip} className="leading-relaxed">
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Frequently Asked Questions
        </h3>
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
