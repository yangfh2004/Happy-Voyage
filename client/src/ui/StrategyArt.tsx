import { useId, type ReactNode } from 'react';
import type { StrategyId } from '@happy-voyage/shared';

/** Original, resolution-independent illustrations: one little maritime story per card. */
export const STRATEGY_PALETTES: Record<StrategyId, readonly [string, string, string]> = {
  navigate: ['#183d63', '#5faab1', '#edca83'], inspire: ['#582c42', '#c77b59', '#ffcf76'],
  mislead: ['#2f294e', '#7e7caa', '#ebc995'], locate: ['#284f50', '#8ba47d', '#f3d28c'],
  betray: ['#342c55', '#9c7897', '#eec77b'], tailwind: ['#195a72', '#91c5bf', '#fff0b5'],
  reverse: ['#204462', '#72a5ac', '#f1cd87'], blockade: ['#332d43', '#9c7a78', '#daba82'],
  plunder: ['#5c3540', '#bd8b5c', '#f8d482'], gale: ['#172c4b', '#617e91', '#c1e5db'],
  escort: ['#204b57', '#6eab9e', '#f0dba1'], exemption: ['#495044', '#a6aa79', '#f5dda0'],
  ambush: ['#172c46', '#5c6e89', '#e9c480'], revolt: ['#5b3548', '#be8468', '#ffd393'],
  harvest: ['#315647', '#97b079', '#f8d78f'], charter: ['#265059', '#86b3a1', '#f1d193'],
  repair: ['#315963', '#8cbab1', '#f3d797'], recall: ['#30465f', '#ae9c8a', '#ffe0a0'],
  exchange: ['#2b4165', '#8c9fbc', '#f1d191'], scorch: ['#512f40', '#ba6756', '#ffd088'],
};

function Ship({ x = 160, y = 145, scale = 1, sail = '#f9e7b3', flip = false }: { x?: number; y?: number; scale?: number; sail?: string; flip?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} strokeLinejoin="round">
    <path d="M-64-5Q0 8 66-12L48 10Q-8 30-51 11Z" fill="#563e3e" stroke="#e5b96e" strokeWidth="2" />
    <path d="M-49 4Q0 17 49 0M-40 12Q0 22 35 10" fill="none" stroke="#b68158" strokeWidth="2" />
    <path d="M0-91V4M-38-62V0M39-61V-4" stroke="#4d3c3c" strokeWidth="4" />
    <path d="M-3-85Q-43-58-27-29L-3-25ZM5-84Q43-65 32-30L5-25ZM-41-59Q-65-38-52-18L-41-17ZM42-58Q65-38 59-22L42-20Z" fill={sail} stroke="#aa8a64" strokeWidth="1.5" />
    <path d="M-3-78L-3-30M6-76L6-30M-25-48L-6-44M9-48L30-44" stroke="#fff7d3" opacity=".6" />
    <path d="M0-92L29-84L0-77Z" fill="#bc5a50" />
    <path d="M-67 20Q-35 12-10 21T57 19M-48 27Q-10 21 27 28" fill="none" stroke="#d0ebe0" strokeWidth="2" opacity=".65" />
  </g>;
}

function Port({ burning = false }: { burning?: boolean }) {
  return <g stroke="#e3c194" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M28 152L46 121H267L290 160Z" fill="#304c54" />
    <path d="M66 131V95H119V135M126 137V80H179V139M190 139V98H247V144" fill="#cba880" />
    <path d="M58 97L92 74L126 97ZM118 82L152 57L188 82ZM181 100L219 74L255 100Z" fill="#734c4c" />
    <path d="M85 132V110H101V135M144 137V99H162V138M211 141V114H228V143" fill="#273c4c" />
    <path d="M38 160H283M56 166H268" stroke="#efd49b" />
    {burning && <g stroke="#ffbd68"><path d="M75 100Q47 74 81 40Q74 69 93 64Q110 24 105 18Q145 58 113 99Z" fill="#df6846" /><path d="M179 101Q159 70 185 53Q182 77 197 71Q202 48 214 35Q240 79 216 105Z" fill="#ee854c" /><path d="M86 98Q73 80 94 66Q89 85 106 78L103 100M187 100Q181 85 199 72L205 104" fill="#ffdc7e" /></g>}
  </g>;
}

function Scroll({ seal = true }: { seal?: boolean }) {
  return <g transform="rotate(-10 160 100)" strokeLinejoin="round">
    <path d="M89 47Q73 37 72 54L76 142Q77 153 93 151H224Q208 145 211 129L207 51Z" fill="#f3d7a0" stroke="#72534a" strokeWidth="3" />
    <path d="M89 47Q105 64 89 70H73M207 51Q225 39 231 52L235 68H213M93 151Q107 134 94 128H212" fill="#d8b77f" stroke="#72534a" strokeWidth="3" />
    <path d="M111 79H185M111 91H190M111 103H172M111 115H156" stroke="#98734e" strokeWidth="3" />
    {seal && <><path d="M184 122L174 162L191 151L202 164L202 121" fill="#ad4c47" /><circle cx="193" cy="119" r="17" fill="#bd6550" stroke="#e8b870" strokeWidth="3" /><path d="M184 120L190 125L202 113" fill="none" stroke="#f9d58d" strokeWidth="3" /></>}
  </g>;
}

const scenes: Record<StrategyId, ReactNode> = {
  navigate: <><path d="M28 168Q87 108 155 136T289 75" fill="none" stroke="#f4d58d" strokeWidth="2" strokeDasharray="5 6" /><Ship x={133} y={158} scale={.9} /><g transform="translate(250 60)"><circle r="32" fill="#1c455d" stroke="#e9ca82" strokeWidth="2" /><circle r="25" fill="none" stroke="#9cb9b3" /><path d="M0-37L7-7L36 0L7 7L0 36L-7 7L-35 0L-7-7Z" fill="#e8c783" /><path d="M0-27L-6 0H0ZM0 27L6 0H0Z" fill="#c76556" /></g></>,
  inspire: <><Ship x={99} y={162} scale={.65} /><Ship x={236} y={163} scale={.65} /><path d="M155 178V31" stroke="#5b3e3e" strokeWidth="6" /><path d="M160 35Q196 19 246 44L226 65L244 91Q198 70 160 86Z" fill="#b94f49" stroke="#f4d089" strokeWidth="2" /><path d="M195 43L200 55L213 55L203 64L207 77L195 70L184 77L187 64L178 55L191 55Z" fill="#f8d68e" /><path d="M50 58L63 66M265 102L279 95M96 37L100 51" stroke="#f2ce88" strokeWidth="3" /></>,
  mislead: <><Ship x={100} y={165} scale={.7} /><path d="M231 155L240 68H255L267 155Z" fill="#e0c9ae" stroke="#4d4655" strokeWidth="3" /><path d="M235 69V50H260V69M230 51L248 35L266 51Z" fill="#67516b" stroke="#e3c89b" strokeWidth="2" /><path d="M240 58L93 37L235 100Z" fill="#f5da96" opacity=".25" /><path d="M136 153Q193 137 190 109T157 104" fill="none" stroke="#f1d59a" strokeDasharray="5 5" strokeWidth="2" /><path d="M156 104L166 97M156 104L166 112" stroke="#f1d59a" strokeWidth="2" /><path d="M270 167L283 145L305 172Z" fill="#333b51" /></>,
  locate: <><g transform="rotate(-9 160 100)"><path d="M63 38L130 48L194 33L258 45L248 161L187 151L124 168L58 154Z" fill="#eed39c" stroke="#6f6452" strokeWidth="3" /><path d="M130 48L124 168M194 33L187 151" stroke="#b79f74" strokeWidth="2" /><path d="M78 67Q93 54 109 70T157 64L166 88L140 109L91 96ZM190 112L214 91L238 115L222 141L198 134Z" fill="#8aa37d" /><path d="M86 130Q120 99 155 122T209 71" fill="none" stroke="#ad6450" strokeDasharray="5 5" strokeWidth="3" /><path d="M198 62L217 81M217 62L198 81" stroke="#ad493e" strokeWidth="5" /><circle cx="83" cy="132" r="4" fill="#ad6450" /></g><path d="M250 160L269 141L283 161L268 179Z" fill="#d2aa5a" stroke="#ffe0a1" strokeWidth="2" /></>,
  betray: <><Ship x={84} y={170} scale={.6} sail="#dfb6ae" /><Ship x={243} y={170} scale={.6} /><path d="M156 147V42" stroke="#443b4b" strokeWidth="4" /><path d="M159 43L200 55L158 74Z" fill="#d5ad72" /><path d="M156 75L116 91L156 103Z" fill="#af6d83" /><path d="M100 78Q155 10 218 73M213 61L218 73L204 72" fill="none" stroke="#f4d296" strokeWidth="3" /><path d="M117 154L154 138L191 155" fill="none" stroke="#d5bd9b" strokeWidth="2" strokeDasharray="4 5" /></>,
  tailwind: <><Ship x={162} y={163} scale={1.05} /><g fill="none" stroke="#e8f1d7" strokeWidth="3" strokeLinecap="round"><path d="M29 46H138Q161 46 155 31Q148 20 139 32M20 64H96M26 82H80Q96 82 92 95M210 41H274Q293 41 289 27M237 60H303" /></g><path d="M35 174Q75 159 99 173M217 176Q247 161 281 170" fill="none" stroke="#f5e5b3" strokeWidth="2" /></>,
  reverse: <><Ship x={158} y={158} scale={.85} flip /><path d="M264 120Q307 164 241 178H89Q48 178 51 142" fill="none" stroke="#f2d18b" strokeWidth="4" /><path d="M36 155L51 138L64 155" fill="none" stroke="#f2d18b" strokeWidth="4" /><path d="M208 45L226 49M220 29L232 40" stroke="#cde0d0" strokeWidth="2" /></>,
  blockade: <><Port /><Ship x={158} y={158} scale={.65} /><g fill="none" stroke="#e0bb7f" strokeWidth="5">{[34, 70, 106, 142, 178, 214, 250, 286].map((x) => <ellipse key={x} cx={x} cy={157 + Math.sin(x / 100) * 15} rx="23" ry="9" transform={`rotate(${x < 145 ? 12 : -8} ${x} 165)`} />)}</g><path d="M24 128V184M296 128V184" stroke="#503e43" strokeWidth="8" /></>,
  plunder: <><path d="M46 173Q95 139 153 167T286 166" fill="#8e7156" /><g stroke="#644748" strokeWidth="3" strokeLinejoin="round"><path d="M94 106H224V165Q156 184 94 162Z" fill="#9d6649" /><path d="M94 105Q84 47 151 47Q218 47 224 106Z" fill="#b68553" /><path d="M106 96Q104 64 151 62Q197 62 207 96Z" fill="#403b42" /><path d="M112 106V168M202 106V169" stroke="#edbf70" strokeWidth="9" /><path d="M94 109H224" stroke="#edbf70" strokeWidth="6" /><rect x="148" y="115" width="24" height="28" rx="3" fill="#e8bc6f" /><path d="M159 122V133" stroke="#654a46" /></g><g fill="#f4ce72" stroke="#ba8c4f" strokeWidth="2">{[112, 130, 148, 166, 184, 203, 239, 255, 225].map((x, i) => <ellipse key={x} cx={x} cy={i < 6 ? 96 - i % 3 * 6 : 169 - i % 3 * 5} rx="10" ry="5" />)}</g></>,
  gale: <><path d="M13 61Q5 33 34 35Q39 13 68 29Q83 7 108 26Q147 17 146 54ZM174 53Q160 28 193 26Q211 3 237 22Q275 12 278 37Q311 29 313 60Z" fill="#2a3c55" /><path d="M239 52L217 86H237L211 125L256 77H237L254 52Z" fill="#f5e7b1" /><Ship x={145} y={164} scale={.76} /><g fill="none" stroke="#91b7c1" strokeWidth="2"><path d="M25 84L14 112M56 83L40 124M284 81L272 112M298 112L284 143M79 101L68 134" /><path d="M10 167Q32 145 54 166T100 166T147 169T194 163T241 167T289 161T330 165" strokeWidth="5" /></g></>,
  escort: <><Ship x={69} y={162} scale={.55} /><Ship x={254} y={162} scale={.55} /><path d="M158 29Q187 49 207 46V104Q204 143 158 164Q112 143 109 104V46Q138 49 158 29Z" fill="#315f66" stroke="#f0cd8b" strokeWidth="4" /><path d="M158 42Q181 58 195 57V101Q194 131 158 150Q124 132 122 101V57Q141 58 158 42Z" fill="none" stroke="#8cb7a5" /><path d="M159 67V120M143 83H175M137 104Q136 133 159 133Q181 133 181 104M137 104L130 114M181 104L188 114" fill="none" stroke="#f0cd8b" strokeWidth="5" /><circle cx="159" cy="65" r="7" fill="none" stroke="#f0cd8b" strokeWidth="3" /></>,
  exemption: <><Port /><path d="M20 176H300" stroke="#8ca9a0" strokeWidth="2" /><Scroll /><path d="M240 142L252 154L277 122" fill="none" stroke="#edf0b9" strokeWidth="5" /></>,
  ambush: <><circle cx="250" cy="46" r="23" fill="#efdaa5" /><circle cx="260" cy="37" r="23" fill="#283c57" /><Port /><Ship x={114} y={174} scale={.9} sail="#4a586c" /><path d="M10 165Q69 145 113 167T220 166T326 165M-5 182Q50 165 104 181T207 182T326 181" fill="none" stroke="#a9bcc4" strokeWidth="10" opacity=".5" /><path d="M82 110L87 120L80 127L74 117Z" fill="#edd19a" /></>,
  revolt: <><Port /><g stroke="#54404a" strokeWidth="3">{[87, 121, 158, 195, 230].map((x, i) => <g key={x}><circle cx={x} cy={153 + i % 2 * 6} r="7" fill="#dfb58b" /><path d={`M${x - 9} 180V168Q${x} 154 ${x + 9} 168V180`} fill={i % 2 ? '#bd6157' : '#4f5862'} /></g>)}</g><path d="M150 145V74M204 147V98" stroke="#4e3c45" strokeWidth="4" /><path d="M151 75L193 83L151 104ZM205 99L238 105L205 123Z" fill="#c95d4d" stroke="#f5c38a" strokeWidth="1.5" /></>,
  harvest: <><path d="M18 157L53 120L91 146L135 113L198 153L250 121L304 157V200H18Z" fill="#5f7951" /><g stroke="#795641" strokeWidth="2"><path d="M72 125H148V170H72ZM173 129H245V175H173Z" fill="#a77e50" /><path d="M75 131H145M75 145H145M75 158H145M177 135H242M177 149H242M177 163H242M82 127L137 168M182 131L236 172" /></g><g fill="none" stroke="#f1d28b" strokeWidth="3">{[113, 142, 168, 195].map((x, i) => <g key={x} transform={`translate(${x} ${95 + i % 2 * 15}) rotate(${i * 14 - 20})`}><path d="M0 48V-32M0 5Q-24-4-18-18Q-3-16 0-2M0-9Q17-12 19-28Q3-27 0-15M0 23Q-26 17-22 2Q-6 3 0 17M0 32Q23 21 22 8Q5 11 0 27" /></g>)}</g></>,
  charter: <><Ship x={67} y={157} scale={.55} /><Ship x={263} y={157} scale={.55} /><Scroll /><path d="M26 168H88M238 170H296" stroke="#e8c98a" strokeWidth="2" /><g fill="#e7bd69" stroke="#8a6b48" strokeWidth="2"><ellipse cx="113" cy="169" rx="23" ry="7" /><ellipse cx="113" cy="161" rx="23" ry="7" /><ellipse cx="113" cy="153" rx="23" ry="7" /></g></>,
  repair: <><Ship x={160} y={172} scale={.9} /><g strokeLinejoin="round"><path d="M80 56L94 42L220 144L204 161Z" fill="#ba8e58" stroke="#583f3b" strokeWidth="3" /><path d="M64 47L90 17L114 39L88 70Z" fill="#c7d1c0" stroke="#eef0ce" strokeWidth="2" /><path d="M104 157L89 140L205 40Q204 20 221 16L218 37L233 47L247 30Q254 50 232 62Z" fill="#d1d5b9" stroke="#627979" strokeWidth="3" /><path d="M91 70L197 153" stroke="#e3bf7b" strokeWidth="3" /></g><path d="M265 88V114M252 101H278" stroke="#e4f1c3" strokeWidth="5" /></>,
  recall: <><path d="M85 140L104 73H120L131 140M188 140L199 73H216L235 140" fill="#c7b697" stroke="#6e6060" strokeWidth="3" /><path d="M105 73L111 42L120 73M199 73L208 40L217 73" fill="#665568" /><path d="M126 140V92H192V140" fill="#d6c09b" stroke="#6e6060" strokeWidth="3" /><path d="M139 140V118Q160 91 179 118V140" fill="#35485c" /><path d="M106 42V25L128 29L106 37M208 41V24L231 28L208 36" fill="#c76c58" /><Ship x={158} y={182} scale={.6} /><path d="M26 171Q52 140 88 147M233 145Q269 143 300 170" fill="none" stroke="#e6d09e" strokeWidth="3" /></>,
  exchange: <><Ship x={86} y={161} scale={.67} sail="#e5bd9d" /><Ship x={242} y={161} scale={.67} flip sail="#c6daca" /><g fill="none" stroke="#efcf8d" strokeWidth="3"><path d="M83 52Q160 4 239 54L225 36M239 54L217 56M235 172Q164 207 85 172L103 171M85 172L98 187" /></g><path d="M155 80L167 94L155 108L143 94Z" fill="#efcf8d" /></>,
  scorch: <><Port burning /><path d="M110 176H208M137 183H181" stroke="#e8b783" strokeWidth="2" /><g fill="#ffd593"><circle cx="141" cy="36" r="2" /><circle cx="229" cy="25" r="2" /><circle cx="157" cy="53" r="1.5" /><circle cx="63" cy="29" r="1.5" /></g><path d="M118 46Q126 29 113 12M222 43Q240 19 228 2" fill="none" stroke="#57384a" strokeWidth="9" opacity=".6" /></>,
};

export function StrategyArt({ id }: { id: StrategyId }) {
  const uid = useId().replace(/:/g, '');
  const [dark, light, gold] = STRATEGY_PALETTES[id];
  return <svg className="strategy-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false" data-art={id}>
    <defs>
      <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor={dark} /><stop offset="1" stopColor={light} /></linearGradient>
      <linearGradient id={`${uid}-sea`} x2="0" y2="1"><stop stopColor={light} /><stop offset="1" stopColor={dark} /></linearGradient>
      <radialGradient id={`${uid}-sun`}><stop stopColor={gold} stopOpacity=".6" /><stop offset="1" stopColor={gold} stopOpacity="0" /></radialGradient>
    </defs>
    <path fill={`url(#${uid}-sky)`} d="M0 0H320V200H0Z" />
    <circle cx="164" cy="80" r="120" fill={`url(#${uid}-sun)`} />
    <circle cx="164" cy="81" r="64" fill="none" stroke={gold} opacity=".18" />
    <circle cx="164" cy="81" r="70" fill="none" stroke={gold} opacity=".1" />
    <path d="M0 130L28 112L57 121L91 104L119 122L153 114L190 132L227 111L253 123L287 107L320 123V200H0Z" fill={dark} opacity=".35" />
    <path d="M0 141Q80 134 160 142T320 140V200H0Z" fill={`url(#${uid}-sea)`} />
    <g stroke={gold} strokeWidth="1" opacity=".25"><path d="M15 154H52M264 151H301M27 180H66M236 185H294M113 189H184" /><path d="M22 33H32M27 28V38M285 26H295M290 21V31" /></g>
    {scenes[id]}
    <path d="M10 45V10H45M275 10H310V45M310 155V190H275M45 190H10V155" fill="none" stroke={gold} opacity=".65" />
    <path d="M15 28V15H28M292 15H305V28M305 172V185H292M28 185H15V172" fill="none" stroke={gold} opacity=".45" />
  </svg>;
}
