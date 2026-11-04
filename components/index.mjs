import button from "./button/index.mjs";
import alert from "./alert/index.mjs";
import badge from "./badge/index.mjs";
import card from "./card/index.mjs";
import checkbox from "./checkbox/index.mjs";
import closeButton from "./close-button/index.mjs";
import grafica from "./grafica/index.mjs";
import icon from "./icon/index.mjs";
import iconButton from "./icon-button/index.mjs";
import modal from "./modal/index.mjs";
import input from "./input/index.mjs";
import radio from "./radio/index.mjs";
import select from "./select/index.mjs";
import selectMenu from "./select-menu/index.mjs";
import selectOption from "./select-option/index.mjs";
import switchComponent from "./switch/index.mjs";
import tabla from "./tabla/index.mjs";
import textarea from "./textarea/index.mjs";
import toast from "./toast/index.mjs";
import tooltip from "./tooltip/index.mjs";

const all = [button, input, textarea, select, checkbox, radio, switchComponent, selectOption, selectMenu, card, badge, alert, toast, tooltip, modal, icon, closeButton, iconButton, tabla, grafica];

export const definitions = new Map(all.map((def) => [def.slug, def]));
export default definitions;
