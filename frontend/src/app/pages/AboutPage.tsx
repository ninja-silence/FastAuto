import { useEffect } from 'react';
import { Shield, Award, Users, Clock } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { useLanguage } from '../i18n/LanguageContext';

import carsImage from '../../assets/cars.jpg';
import alexImage from '../../assets/Alex_1.png';
import matveyImage from '../../assets/Matt.png';
import alekseyImage from '../../assets/Alex2_1.png';
import danilaImage from '../../assets/Danila2.png';
import timofeyImage from '../../assets/Tima.png';

export function AboutPage() {
  const { T } = useLanguage();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const teamMembers = [
    { name: 'Чувилов Александр', role: 'Тимлид', image: alexImage },
    { name: 'Барышев Данила', role: 'Архитектор (Возможно умер)', image: danilaImage },
    { name: 'Жуков Тимофей', role: 'Frontend-разработчик (Возможно умер)', image: timofeyImage },
    { name: 'Дворников Матвей', role: 'Backend-разработчик', image: matveyImage },
    { name: 'Иващенко Алексей', role: 'Тестировщик', image: alekseyImage },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Заголовок */}
      <section className="bg-primary text-primary-foreground py-16 group">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-semibold mb-4 transition-transform duration-300 group-hover:scale-105 origin-left">
            {T.about.title}
          </h1>
          <p className="text-lg opacity-90 max-w-3xl transition-transform duration-300 group-hover:scale-105 origin-left">
            {T.about.subtitle}
          </p>
        </div>
      </section>

      {/* Статистика */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Clock,  label: T.about.yearsLabel,    desc: T.about.yearsDesc },
            { icon: Users,  label: T.about.clientsLabel,  desc: T.about.clientsDesc },
            { icon: Shield, label: T.about.verifiedLabel, desc: T.about.verifiedDesc },
            { icon: Award,  label: T.about.bestLabel,     desc: T.about.bestDesc },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="text-center group cursor-default">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4
                transition-all duration-300
                group-hover:scale-110 group-hover:bg-primary/20
                group-hover:shadow-[0_0_18px_4px_hsl(var(--primary)/0.35)]
                group-hover:ring-2 group-hover:ring-primary/30">
                <Icon className="w-8 h-8 text-primary transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 className="text-xl font-semibold mb-2 transition-transform duration-300 group-hover:scale-105">{label}</h3>
              <p className="text-muted-foreground transition-transform duration-300 group-hover:scale-105">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* О компании */}
      <section className="bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center group">

            <div className="space-y-4">
              <h2 className="text-3xl font-semibold mb-6 transition-transform duration-300 group-hover:scale-105 origin-left">
                {T.about.historyTitle}
              </h2>
              <div className="text-muted-foreground space-y-4">
                <p className="transition-transform duration-300 group-hover:scale-105 origin-left">
                  {T.about.historyText}
                </p>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden transition-all duration-500 ease-out
              group-hover:shadow-[0_0_32px_8px_hsl(var(--primary)/0.35)]
              group-hover:ring-2 group-hover:ring-primary/20">
              <ImageWithFallback
                src={carsImage}
                alt="Наш автосалон"
                className="w-full h-[400px] object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
            </div>

          </div>
        </div>
      </section>

      {/* Наша команда */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 group">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-semibold mb-4 transition-transform duration-300 group-hover:scale-105">
            {T.about.teamTitle}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto transition-transform duration-300 group-hover:scale-105">
            {T.about.teamSubtitle}
          </p>
        </div>

        <div className="overflow-x-hidden pb-8">
          <div className="md:grid grid-cols-6 gap-x-15 gap-y-20 md:min-w-200 max-w-6xl mx-auto space-y-20 md:space-y-0">
            {[teamMembers[0], teamMembers[3], teamMembers[4]].map((member) => (
              <div
                key={member.name}
                className="col-span-2 text-center group/member cursor-default"
              >
                <div className="w-44 h-44 rounded-full bg-secondary mx-auto mb-4 overflow-hidden
                  transition-[filter] duration-300
                  group-hover/member:drop-shadow-[0_0_14px_hsl(var(--primary)/0.7)]">
                  <ImageWithFallback
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/member:scale-110"
                  />
                </div>
                <h3 className="text-2xl font-semibold mb-1 transition-transform duration-300 group-hover/member:scale-105">
                  {member.name}
                </h3>
                <p className="text-muted-foreground text-base font-medium transition-transform duration-300 group-hover/member:scale-105">
                  {member.role}
                </p>
              </div>
            ))}
            {[teamMembers[1], teamMembers[2]].map((member, i) => (
              <div
                key={member.name}
                className={`col-span-2 text-center group/member cursor-default ${i === 0 ? 'col-start-2' : 'col-start-4'}`}
              >
                <div className="w-44 h-44 rounded-full bg-secondary mx-auto mb-4 overflow-hidden
                  transition-[filter] duration-300
                  group-hover/member:drop-shadow-[0_0_14px_hsl(var(--primary)/0.7)]">
                  <ImageWithFallback
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/member:scale-110"
                  />
                </div>
                <h3 className="text-2xl font-semibold mb-1 transition-transform duration-300 group-hover/member:scale-105">
                  {member.name}
                </h3>
                <p className="text-muted-foreground text-base font-medium transition-transform duration-300 group-hover/member:scale-105">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Контакты */}
      <section className="bg-secondary py-16 group">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-semibold mb-4 transition-transform duration-300 group-hover:scale-105">
            {T.about.contactTitle}
          </h2>
          <p className="text-muted-foreground mb-8 transition-transform duration-300 group-hover:scale-105">
            {T.about.contactSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+79001234567"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg
                transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
            >
              {T.about.callBtn}
            </a>
            <a
              href="mailto:info@autosalon.ru"
              className="px-8 py-3 bg-background text-foreground border border-border rounded-lg
                transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-95"
            >
              {T.about.emailBtn}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
