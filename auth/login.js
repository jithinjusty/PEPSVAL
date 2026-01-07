import { supabase } from "/js/supabaseClient.js";
import { ROUTES } from "/js/config.js";

function $(id){ return document.getElementById(id); }

const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password