--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE celex_db;
--
-- Name: celex_db; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE celex_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'es_MX.UTF-8';


ALTER DATABASE celex_db OWNER TO postgres;

\connect celex_db

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: asistencia_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.asistencia_estado AS ENUM (
    'presente',
    'ausente',
    'retardo',
    'justificado'
);


ALTER TYPE public.asistencia_estado OWNER TO postgres;

--
-- Name: diasemana; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.diasemana AS ENUM (
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'domingo'
);


ALTER TYPE public.diasemana OWNER TO postgres;

--
-- Name: idioma; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.idioma AS ENUM (
    'ingles',
    'frances',
    'aleman',
    'italiano',
    'portugues'
);


ALTER TYPE public.idioma OWNER TO postgres;

--
-- Name: inscripcion_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.inscripcion_tipo AS ENUM (
    'pago',
    'exencion'
);


ALTER TYPE public.inscripcion_tipo OWNER TO postgres;

--
-- Name: inscripciontipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.inscripciontipo AS ENUM (
    'pago',
    'exencion'
);


ALTER TYPE public.inscripciontipo OWNER TO postgres;

--
-- Name: modalidad; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.modalidad AS ENUM (
    'intensivo',
    'sabatino',
    'semestral'
);


ALTER TYPE public.modalidad OWNER TO postgres;

--
-- Name: modalidadasistencia; Type: TYPE; Schema: public; Owner: vsalazar
--

CREATE TYPE public.modalidadasistencia AS ENUM (
    'presencial',
    'virtual'
);


ALTER TYPE public.modalidadasistencia OWNER TO vsalazar;

--
-- Name: nivel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.nivel AS ENUM (
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2'
);


ALTER TYPE public.nivel OWNER TO postgres;

--
-- Name: placementregistrostatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.placementregistrostatus AS ENUM (
    'PREINSCRITA',
    'VALIDADA',
    'RECHAZADA',
    'CANCELADA'
);


ALTER TYPE public.placementregistrostatus OWNER TO postgres;

--
-- Name: turno; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.turno AS ENUM (
    'matutino',
    'vespertino',
    'mixto'
);


ALTER TYPE public.turno OWNER TO postgres;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userrole AS ENUM (
    'student',
    'teacher',
    'coordinator',
    'superuser'
);


ALTER TYPE public.userrole OWNER TO postgres;

--
-- Name: ensure_timestamps(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;
    IF NEW.updated_at IS NULL THEN
      NEW.updated_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- en updates, siempre toca updated_at si viene NULL
    IF NEW.updated_at IS NULL THEN
      NEW.updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_timestamps() OWNER TO postgres;

--
-- Name: evaluaciones_autocalcula_totales(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.evaluaciones_autocalcula_totales() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.subtotal_medio IS NULL THEN
    NEW.subtotal_medio :=
      COALESCE(NEW.medio_examen,0) + COALESCE(NEW.medio_continua,0);
  END IF;

  IF NEW.subtotal_final IS NULL THEN
    NEW.subtotal_final :=
      COALESCE(NEW.final_examen,0) + COALESCE(NEW.final_continua,0) + COALESCE(NEW.final_tarea,0);
  END IF;

  IF NEW.promedio_final IS NULL THEN
    NEW.promedio_final := ROUND((
      (COALESCE(NEW.medio_examen,0) + COALESCE(NEW.medio_continua,0) +
       COALESCE(NEW.final_examen,0) + COALESCE(NEW.final_continua,0) + COALESCE(NEW.final_tarea,0)
      ) / 2.0
    )::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.evaluaciones_autocalcula_totales() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asistencia_registro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_registro (
    id integer NOT NULL,
    sesion_id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    estado public.asistencia_estado DEFAULT 'presente'::public.asistencia_estado NOT NULL,
    nota text,
    marcado_por_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.asistencia_registro OWNER TO postgres;

--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_registro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_registro_id_seq OWNER TO postgres;

--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_registro_id_seq OWNED BY public.asistencia_registro.id;


--
-- Name: asistencia_sesion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_sesion (
    id integer NOT NULL,
    ciclo_id integer NOT NULL,
    fecha date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.asistencia_sesion OWNER TO postgres;

--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_sesion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_sesion_id_seq OWNER TO postgres;

--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_sesion_id_seq OWNED BY public.asistencia_sesion.id;


--
-- Name: ciclos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ciclos (
    id integer NOT NULL,
    codigo character varying(120) NOT NULL,
    modalidad public.modalidad NOT NULL,
    turno public.turno NOT NULL,
    insc_inicio date NOT NULL,
    insc_fin date NOT NULL,
    curso_inicio date NOT NULL,
    curso_fin date NOT NULL,
    examen_mt date,
    examen_final date,
    notas text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    idioma public.idioma NOT NULL,
    cupo_total integer NOT NULL,
    nivel public.nivel NOT NULL,
    dias text[] DEFAULT '{}'::text[],
    hora_inicio time without time zone DEFAULT '00:00:00'::time without time zone,
    hora_fin time without time zone DEFAULT '23:59:00'::time without time zone,
    modalidad_asistencia public.modalidadasistencia DEFAULT 'presencial'::public.modalidadasistencia NOT NULL,
    aula character varying(120),
    docente_id integer,
    CONSTRAINT ck_ciclos_cupo_total_nonneg CHECK ((cupo_total >= 0))
);


ALTER TABLE public.ciclos OWNER TO postgres;

--
-- Name: ciclos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ciclos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ciclos_id_seq OWNER TO postgres;

--
-- Name: ciclos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ciclos_id_seq OWNED BY public.ciclos.id;


--
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluaciones (
    id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    medio_examen integer DEFAULT 0,
    medio_continua integer DEFAULT 0,
    final_examen integer DEFAULT 0,
    final_continua integer DEFAULT 0,
    final_tarea integer DEFAULT 0,
    updated_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subtotal_medio integer DEFAULT 0,
    subtotal_final integer DEFAULT 0,
    promedio_final numeric(5,2) DEFAULT 0,
    CONSTRAINT evaluaciones_final_continua_check CHECK (((final_continua >= 0) AND (final_continua <= 20))),
    CONSTRAINT evaluaciones_final_examen_check CHECK (((final_examen >= 0) AND (final_examen <= 60))),
    CONSTRAINT evaluaciones_final_tarea_check CHECK (((final_tarea >= 0) AND (final_tarea <= 20))),
    CONSTRAINT evaluaciones_medio_continua_check CHECK (((medio_continua >= 0) AND (medio_continua <= 20))),
    CONSTRAINT evaluaciones_medio_examen_check CHECK (((medio_examen >= 0) AND (medio_examen <= 80)))
);


ALTER TABLE public.evaluaciones OWNER TO postgres;

--
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evaluaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluaciones_id_seq OWNER TO postgres;

--
-- Name: evaluaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evaluaciones_id_seq OWNED BY public.evaluaciones.id;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos (
    id integer NOT NULL,
    codigo character varying(64) NOT NULL,
    ciclo_id integer NOT NULL,
    cupo_total integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT ck_grupos_cupo_total_nonneg CHECK ((cupo_total >= 0))
);


ALTER TABLE public.grupos OWNER TO postgres;

--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grupos_id_seq OWNER TO postgres;

--
-- Name: grupos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_id_seq OWNED BY public.grupos.id;


--
-- Name: inscripciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inscripciones (
    id integer NOT NULL,
    alumno_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    status character varying(20) DEFAULT 'registrada'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    referencia character varying(50),
    importe_centavos integer,
    comprobante_path character varying(255),
    comprobante_mime character varying(100),
    comprobante_size integer,
    tipo public.inscripcion_tipo DEFAULT 'pago'::public.inscripcion_tipo NOT NULL,
    fecha_pago date,
    alumno_is_ipn boolean DEFAULT false NOT NULL,
    comprobante_estudios_path character varying(255),
    comprobante_estudios_mime character varying(100),
    comprobante_estudios_size integer,
    comprobante_exencion_path character varying(255),
    comprobante_exencion_mime character varying(100),
    comprobante_exencion_size integer,
    validated_by_id integer,
    validated_at timestamp with time zone,
    validation_notes text,
    rechazo_motivo text,
    rechazada_at timestamp with time zone,
    CONSTRAINT ck_insc_estudios_si_ipn CHECK (((tipo <> 'pago'::public.inscripcion_tipo) OR (NOT alumno_is_ipn) OR (comprobante_estudios_path IS NOT NULL))),
    CONSTRAINT ck_insc_exencion_requiere_comprobante CHECK (((tipo <> 'exencion'::public.inscripcion_tipo) OR (comprobante_exencion_path IS NOT NULL)))
);


ALTER TABLE public.inscripciones OWNER TO postgres;

--
-- Name: inscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inscripciones_id_seq OWNER TO postgres;

--
-- Name: inscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inscripciones_id_seq OWNED BY public.inscripciones.id;


--
-- Name: placement_exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.placement_exams (
    id integer NOT NULL,
    codigo character varying(50) NOT NULL,
    idioma character varying(30) NOT NULL,
    fecha date NOT NULL,
    hora time without time zone NOT NULL,
    salon character varying(120),
    duracion_min integer NOT NULL,
    cupo_total integer NOT NULL,
    costo integer,
    docente_id integer,
    nombre character varying(120) NOT NULL,
    modalidad character varying(30),
    nivel_objetivo character varying(10),
    estado character varying(20) NOT NULL,
    instrucciones text,
    link_registro character varying(255),
    activo boolean NOT NULL,
    insc_inicio date,
    insc_fin date,
    CONSTRAINT ck_place_cupo_nonneg CHECK ((cupo_total >= 0)),
    CONSTRAINT ck_place_duracion_pos CHECK ((duracion_min > 0)),
    CONSTRAINT ck_placement_insc_window_order CHECK (((insc_inicio IS NULL) OR (insc_fin IS NULL) OR (insc_inicio <= insc_fin)))
);


ALTER TABLE public.placement_exams OWNER TO postgres;

--
-- Name: placement_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.placement_exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.placement_exams_id_seq OWNER TO postgres;

--
-- Name: placement_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.placement_exams_id_seq OWNED BY public.placement_exams.id;


--
-- Name: placement_registros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.placement_registros (
    id integer NOT NULL,
    alumno_id integer NOT NULL,
    exam_id integer NOT NULL,
    status character varying(20) NOT NULL,
    referencia character varying(50),
    importe_centavos integer,
    fecha_pago date,
    comprobante_path character varying(255),
    comprobante_mime character varying(100),
    comprobante_size integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rechazo_motivo text,
    validation_notes text,
    validated_by_id integer,
    validated_at timestamp with time zone,
    nivel_idioma character varying(20),
    CONSTRAINT ck_nivel_idioma_len CHECK (((nivel_idioma IS NULL) OR ((length((nivel_idioma)::text) >= 1) AND (length((nivel_idioma)::text) <= 20)))),
    CONSTRAINT ck_pago_no_neg CHECK (((importe_centavos IS NULL) OR (importe_centavos >= 0)))
);


ALTER TABLE public.placement_registros OWNER TO postgres;

--
-- Name: placement_registros_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.placement_registros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.placement_registros_id_seq OWNER TO postgres;

--
-- Name: placement_registros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.placement_registros_id_seq OWNED BY public.placement_registros.id;


--
-- Name: survey_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_answers (
    id integer NOT NULL,
    response_id integer NOT NULL,
    question_id integer NOT NULL,
    value_int integer,
    value_bool boolean,
    value_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_answers OWNER TO postgres;

--
-- Name: survey_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_answers_id_seq OWNER TO postgres;

--
-- Name: survey_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_answers_id_seq OWNED BY public.survey_answers.id;


--
-- Name: survey_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    "order" integer NOT NULL,
    active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_categories OWNER TO postgres;

--
-- Name: survey_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_categories_id_seq OWNER TO postgres;

--
-- Name: survey_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_categories_id_seq OWNED BY public.survey_categories.id;


--
-- Name: survey_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_questions (
    id integer NOT NULL,
    category_id integer NOT NULL,
    text text NOT NULL,
    help_text text,
    type character varying(20) NOT NULL,
    required boolean NOT NULL,
    active boolean NOT NULL,
    "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_questions OWNER TO postgres;

--
-- Name: survey_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_questions_id_seq OWNER TO postgres;

--
-- Name: survey_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_questions_id_seq OWNED BY public.survey_questions.id;


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_responses (
    id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    alumno_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comments text
);


ALTER TABLE public.survey_responses OWNER TO postgres;

--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_responses_id_seq OWNER TO postgres;

--
-- Name: survey_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_responses_id_seq OWNED BY public.survey_responses.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(120) NOT NULL,
    last_name character varying(160) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified boolean,
    hashed_password character varying(255) NOT NULL,
    is_ipn boolean,
    boleta character varying(10),
    curp character varying(18) NOT NULL,
    role public.userrole NOT NULL,
    is_active boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    telefono character varying(20),
    addr_calle character varying(200),
    addr_numero character varying(50),
    addr_colonia character varying(200),
    addr_municipio character varying(200),
    addr_estado character varying(200),
    addr_cp character varying(10),
    ipn_nivel character varying(30),
    ipn_unidad character varying(120),
    tutor_telefono character varying(20)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: asistencia_registro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro ALTER COLUMN id SET DEFAULT nextval('public.asistencia_registro_id_seq'::regclass);


--
-- Name: asistencia_sesion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion ALTER COLUMN id SET DEFAULT nextval('public.asistencia_sesion_id_seq'::regclass);


--
-- Name: ciclos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ciclos ALTER COLUMN id SET DEFAULT nextval('public.ciclos_id_seq'::regclass);


--
-- Name: evaluaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_id_seq'::regclass);


--
-- Name: grupos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id SET DEFAULT nextval('public.grupos_id_seq'::regclass);


--
-- Name: inscripciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones ALTER COLUMN id SET DEFAULT nextval('public.inscripciones_id_seq'::regclass);


--
-- Name: placement_exams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_exams ALTER COLUMN id SET DEFAULT nextval('public.placement_exams_id_seq'::regclass);


--
-- Name: placement_registros id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros ALTER COLUMN id SET DEFAULT nextval('public.placement_registros_id_seq'::regclass);


--
-- Name: survey_answers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers ALTER COLUMN id SET DEFAULT nextval('public.survey_answers_id_seq'::regclass);


--
-- Name: survey_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_categories ALTER COLUMN id SET DEFAULT nextval('public.survey_categories_id_seq'::regclass);


--
-- Name: survey_questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_questions ALTER COLUMN id SET DEFAULT nextval('public.survey_questions_id_seq'::regclass);


--
-- Name: survey_responses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses ALTER COLUMN id SET DEFAULT nextval('public.survey_responses_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: asistencia_registro; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asistencia_registro (id, sesion_id, inscripcion_id, estado, nota, marcado_por_id, created_at, updated_at) FROM stdin;
23	32	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
26	33	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
29	34	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
32	35	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
35	36	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
38	37	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
41	38	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
44	39	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
47	40	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
50	41	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
53	42	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
56	43	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
59	44	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
62	45	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
65	46	34	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
66	46	35	presente	\N	24	2025-09-06 18:02:14.644951-06	\N
60	44	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
63	45	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
64	46	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:06:22.876689-06
3	25	35	ausente	\N	24	2025-09-06 17:47:12.345785-06	2025-09-09 00:08:25.901089-06
9	27	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
12	28	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
15	29	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
18	30	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
21	31	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
24	32	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
27	33	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
14	29	34	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
17	30	34	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
20	31	34	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
22	32	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
25	33	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
28	34	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
31	35	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-06 18:52:06.786099-06
30	34	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
33	35	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
36	36	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
39	37	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
42	38	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
45	39	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
46	40	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
49	41	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
52	42	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
55	43	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
58	44	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
61	45	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 22:39:31.572597-06
2	25	34	ausente	\N	24	2025-09-06 17:47:12.345785-06	2025-09-08 22:47:16.209272-06
72	2351	34	ausente	\N	24	2025-09-06 19:16:28.393328-06	2025-09-08 22:47:16.209272-06
73	2351	35	ausente	\N	24	2025-09-06 19:16:28.393328-06	2025-09-08 23:01:32.692365-06
48	40	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
6	26	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:09:14.345299-06
1	25	33	presente	\N	24	2025-09-06 17:47:12.345785-06	2025-09-08 23:20:02.53558-06
4	26	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:20:02.53558-06
7	27	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:20:02.53558-06
71	2351	33	presente	\N	24	2025-09-06 19:16:28.393328-06	2025-09-08 23:20:02.53558-06
5	26	34	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
8	27	34	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
10	28	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
11	28	34	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
13	29	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
16	30	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
19	31	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
34	36	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
37	37	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
40	38	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
43	39	33	presente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-08 23:22:56.890928-06
51	41	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
54	42	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
57	43	35	ausente	\N	24	2025-09-06 18:02:14.644951-06	2025-09-09 00:08:25.901089-06
\.


--
-- Data for Name: asistencia_sesion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asistencia_sesion (id, ciclo_id, fecha, created_at, updated_at) FROM stdin;
1	18	2025-10-01	2025-09-06 17:41:07.284902-06	\N
3	18	2025-10-02	2025-09-06 17:41:07.284902-06	\N
4	18	2025-10-03	2025-09-06 17:41:07.284902-06	\N
5	18	2025-10-06	2025-09-06 17:41:07.284902-06	\N
6	18	2025-10-07	2025-09-06 17:41:07.284902-06	\N
7	18	2025-10-08	2025-09-06 17:41:07.284902-06	\N
8	18	2025-10-09	2025-09-06 17:41:07.284902-06	\N
9	18	2025-10-10	2025-09-06 17:41:07.284902-06	\N
10	18	2025-10-13	2025-09-06 17:41:07.284902-06	\N
11	18	2025-10-14	2025-09-06 17:41:07.284902-06	\N
12	18	2025-10-15	2025-09-06 17:41:07.284902-06	\N
13	18	2025-10-16	2025-09-06 17:41:07.284902-06	\N
14	18	2025-10-17	2025-09-06 17:41:07.284902-06	\N
15	18	2025-10-20	2025-09-06 17:41:07.284902-06	\N
16	18	2025-10-21	2025-09-06 17:41:07.284902-06	\N
17	18	2025-10-22	2025-09-06 17:41:07.284902-06	\N
18	18	2025-10-23	2025-09-06 17:41:07.284902-06	\N
19	18	2025-10-24	2025-09-06 17:41:07.284902-06	\N
20	18	2025-10-27	2025-09-06 17:41:07.284902-06	\N
21	18	2025-10-28	2025-09-06 17:41:07.284902-06	\N
22	18	2025-10-29	2025-09-06 17:41:07.284902-06	\N
23	18	2025-10-30	2025-09-06 17:41:07.284902-06	\N
24	18	2025-10-31	2025-09-06 17:41:07.284902-06	\N
25	17	2025-09-09	2025-09-06 17:47:12.189131-06	\N
26	17	2025-09-10	2025-09-06 17:47:12.189131-06	\N
27	17	2025-09-11	2025-09-06 17:47:12.189131-06	\N
28	17	2025-09-12	2025-09-06 17:47:12.189131-06	\N
29	17	2025-09-15	2025-09-06 17:47:12.189131-06	\N
30	17	2025-09-16	2025-09-06 17:47:12.189131-06	\N
31	17	2025-09-17	2025-09-06 17:47:12.189131-06	\N
32	17	2025-09-18	2025-09-06 17:47:12.189131-06	\N
33	17	2025-09-19	2025-09-06 17:47:12.189131-06	\N
34	17	2025-09-22	2025-09-06 17:47:12.189131-06	\N
35	17	2025-09-23	2025-09-06 17:47:12.189131-06	\N
36	17	2025-09-24	2025-09-06 17:47:12.189131-06	\N
37	17	2025-09-25	2025-09-06 17:47:12.189131-06	\N
38	17	2025-09-26	2025-09-06 17:47:12.189131-06	\N
39	17	2025-09-29	2025-09-06 17:47:12.189131-06	\N
40	17	2025-09-30	2025-09-06 17:47:12.189131-06	\N
41	17	2025-10-01	2025-09-06 17:47:12.189131-06	\N
42	17	2025-10-02	2025-09-06 17:47:12.189131-06	\N
43	17	2025-10-03	2025-09-06 17:47:12.189131-06	\N
44	17	2025-10-06	2025-09-06 17:47:12.189131-06	\N
45	17	2025-10-07	2025-09-06 17:47:12.189131-06	\N
46	17	2025-10-08	2025-09-06 17:47:12.189131-06	\N
463	19	2025-09-16	2025-09-06 18:12:33.167394-06	\N
464	19	2025-09-17	2025-09-06 18:12:33.167394-06	\N
465	19	2025-09-18	2025-09-06 18:12:33.167394-06	\N
466	19	2025-09-19	2025-09-06 18:12:33.167394-06	\N
467	19	2025-09-22	2025-09-06 18:12:33.167394-06	\N
468	19	2025-09-23	2025-09-06 18:12:33.167394-06	\N
469	19	2025-09-24	2025-09-06 18:12:33.167394-06	\N
470	19	2025-09-25	2025-09-06 18:12:33.167394-06	\N
471	19	2025-09-26	2025-09-06 18:12:33.167394-06	\N
472	19	2025-09-29	2025-09-06 18:12:33.167394-06	\N
473	19	2025-09-30	2025-09-06 18:12:33.167394-06	\N
474	19	2025-10-01	2025-09-06 18:12:33.167394-06	\N
475	19	2025-10-02	2025-09-06 18:12:33.167394-06	\N
476	19	2025-10-03	2025-09-06 18:12:33.167394-06	\N
477	19	2025-10-06	2025-09-06 18:12:33.167394-06	\N
478	19	2025-10-07	2025-09-06 18:12:33.167394-06	\N
479	19	2025-10-08	2025-09-06 18:12:33.167394-06	\N
480	19	2025-10-09	2025-09-06 18:12:33.167394-06	\N
481	19	2025-10-10	2025-09-06 18:12:33.167394-06	\N
482	19	2025-10-13	2025-09-06 18:12:33.167394-06	\N
483	19	2025-10-14	2025-09-06 18:12:33.167394-06	\N
484	19	2025-10-15	2025-09-06 18:12:33.167394-06	\N
485	19	2025-10-16	2025-09-06 18:12:33.167394-06	\N
555	20	2025-10-04	2025-09-06 18:19:08.373621-06	\N
556	20	2025-10-11	2025-09-06 18:19:08.373621-06	\N
557	20	2025-10-18	2025-09-06 18:19:08.373621-06	\N
558	20	2025-10-25	2025-09-06 18:19:08.373621-06	\N
2351	17	2025-09-08	2025-09-06 19:16:28.382041-06	\N
\.


--
-- Data for Name: ciclos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ciclos (id, codigo, modalidad, turno, insc_inicio, insc_fin, curso_inicio, curso_fin, examen_mt, examen_final, notas, created_at, updated_at, idioma, cupo_total, nivel, dias, hora_inicio, hora_fin, modalidad_asistencia, aula, docente_id) FROM stdin;
3	ING-B1-G07	intensivo	matutino	2025-08-25	2025-08-28	2025-08-28	2025-09-29	\N	\N	Esta es una nota importante de prueba para la creacion del primer curso Esta es una nota importante de prueba para la creacion del primer curso	2025-08-28 21:19:58.380012-06	\N	ingles	20	A1	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	405	\N
4	ALE-B2-G07	sabatino	vespertino	2025-08-25	2025-08-28	2025-08-28	2025-09-30	\N	2025-09-24	CD CDDDC DCDCSD S DSCDCS  SDD CS	2025-08-28 21:27:30.155894-06	\N	aleman	50	B1	{sabado}	17:00:00	21:00:00	presencial	301	\N
5	FRA-B1-G12	intensivo	vespertino	2025-08-26	2025-08-28	2025-08-28	2025-09-29	\N	\N	hgfhfghfghgfhfgh	2025-08-28 22:17:16.127831-06	\N	frances	45	A2	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	898	15
6	ALE-B2-G08	intensivo	matutino	2025-08-25	2025-08-27	2025-08-28	2025-10-03	\N	\N	Aviso nuevo	2025-08-28 22:54:37.853074-06	\N	aleman	15	A1	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	859	15
7	ESPA-02	intensivo	matutino	2025-08-25	2025-08-28	2025-08-28	2025-09-29	\N	2025-10-23	gdfgdfgdgdf gfd dg gf	2025-08-28 23:03:38.908459-06	\N	ingles	10	A2	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	455	15
8	edfrrr	sabatino	vespertino	2025-08-28	2025-08-29	2025-08-28	2025-09-30	\N	\N	jgjghjghj	2025-08-28 23:23:07.04952-06	\N	portugues	50	A2	{sabado}	08:30:00	13:30:00	presencial	11	15
9	ING-b1-G05	intensivo	matutino	2025-08-28	2025-08-30	2025-08-31	2025-09-30	\N	\N	DFSDF SFSD FFDSS S D FDDS F DFFDD F	2025-08-31 12:56:08.911791-06	\N	ingles	10	A2	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	7777	15
10	ING-D1-G07	intensivo	matutino	2025-08-31	2025-09-05	2025-09-08	2025-09-30	\N	\N	G  G FF DG FD FGDG F DDF FDGG	2025-08-31 13:12:22.624417-06	\N	ingles	25	A1	{lunes,martes,miercoles,jueves,viernes}	07:00:00	07:30:00	presencial	458	\N
11	FRA-B1-G19	intensivo	matutino	2025-08-31	2025-09-06	2025-09-08	2025-09-30	2025-09-18	2025-09-30	hghghfghgfhfh	2025-08-31 14:03:30.105793-06	\N	frances	25	A2	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	85	15
12	ING-B5-G07	intensivo	vespertino	2025-08-29	2025-09-06	2025-09-08	2025-09-27	2025-09-25	2025-09-26	esta nota es de prueba	2025-08-31 19:49:26.969632-06	\N	ingles	10	B1	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	89	15
14	PRUEBA 2	intensivo	vespertino	2025-08-31	2025-09-07	2025-09-09	2025-10-01	2025-09-27	2025-09-28	GG  FD  FDGD GFFD GGFDGDG	2025-08-31 22:20:30.742592-06	\N	frances	100	A2	{lunes,martes,miercoles,jueves,viernes}	06:00:00	08:00:00	presencial	102	15
15	curso de prueba 1	intensivo	matutino	2025-09-06	2025-09-13	2025-09-15	2025-10-15	2025-09-26	2025-10-04	AVISO DEL CURSO 1	2025-09-06 12:32:11.696413-06	\N	ingles	25	A2	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	501	15
18	INGLES-ct7	intensivo	matutino	2025-09-06	2025-09-11	2025-10-01	2025-10-31	2025-09-26	2025-10-05	IHOF HFD HS HHS D HJFD HJFSDJ HFSD HDF HSD HFDS H H H HJ FHJS HJDF HJDDF JJSL  LSL F S HF HLSDHJLJDSL SLH F LS LLJHSL  LHFSL HJ HDJF HSHF LS L HJ	2025-09-06 16:47:23.791802-06	\N	ingles	10	B1	{lunes,martes,miercoles,jueves,viernes}	07:00:00	09:00:00	presencial	789	24
20	SABATINO	sabatino	matutino	2025-09-06	2025-09-13	2025-10-04	2025-10-25	\N	\N	\N	2025-09-06 18:18:55.216478-06	\N	frances	5	B1	{sabado}	07:00:00	13:00:00	presencial	701	24
16	curso de prueba 2	sabatino	vespertino	2025-09-06	2025-09-14	2025-09-01	2025-09-10	2025-09-20	2025-10-02	AVISOS DEL CURSO NUMERO 2	2025-09-06 12:33:25.25321-06	2025-09-14 18:13:54.400294-06	frances	20	B1	{sabado}	07:30:00	09:00:00	presencial	410	15
17	CURSODE 3	intensivo	matutino	2025-09-06	2025-09-08	2025-09-08	2025-10-08	2025-10-02	2025-10-04	notas jj lksj asj klsa jkd jklsdj kldajklladjka dsj a jj k jk kjfdjk f jkl jklfk jaj kfkjl aj falk fklasj fklj safklk sfksa f klsjfll	2025-09-06 16:22:07.25581-06	2025-09-06 19:17:41.228959-06	ingles	3	B1	{lunes,martes,miercoles,jueves,viernes}	06:00:00	08:30:00	presencial	205	24
13	PRUEBA	intensivo	matutino	2025-09-20	2025-09-20	2025-10-15	2025-11-16	2025-09-28	2025-09-30	MENSAJE DE PRUEBA	2025-08-31 20:44:09.355604-06	2025-09-15 00:48:37.268726-06	ingles	10	B1	{lunes,martes,miercoles,jueves,viernes}	06:30:00	08:30:00	presencial	77	15
19	ASISTENCIA	intensivo	matutino	2025-09-13	2025-09-19	2025-09-19	2025-09-27	2025-10-08	2025-10-15	BYBYTRHHD G HG HHHG FFG H	2025-09-06 18:12:26.415353-06	2025-09-15 00:49:11.762527-06	ingles	3	B1	{lunes,martes,miercoles,jueves,viernes}	08:00:00	09:30:00	presencial	101	24
21	CURSO-1	intensivo	matutino	2025-09-08	2025-09-19	2025-10-01	2025-10-31	2025-10-15	2025-09-18	GFDGDFGDGDFGDFGFDGDFG	2025-09-15 00:57:42.9686-06	\N	ingles	10	A1	{lunes,martes,miercoles,jueves,viernes}	07:30:00	08:30:00	presencial	101	24
22	CURSO-2	sabatino	vespertino	2025-09-12	2025-09-19	2025-10-01	2025-10-31	2025-10-25	2025-10-17	FSDFSDFDSFSDFSDFSDFSD	2025-09-15 00:58:44.567022-06	\N	ingles	15	A2	{sabado}	07:30:00	08:30:00	presencial	105	24
\.


--
-- Data for Name: evaluaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluaciones (id, inscripcion_id, ciclo_id, medio_examen, medio_continua, final_examen, final_continua, final_tarea, updated_by_id, created_at, updated_at, subtotal_medio, subtotal_final, promedio_final) FROM stdin;
4	33	17	70	10	50	10	10	24	2025-09-08 22:25:28.203845-06	2025-09-08 22:25:28.203845-06	80	70	75.00
6	35	17	\N	\N	\N	\N	\N	24	2025-09-09 00:08:51.311268-06	2025-09-09 00:08:51.311268-06	0	0	0.00
5	34	17	80	20	60	10	10	24	2025-09-08 22:25:39.375171-06	2025-09-09 00:19:29.233848-06	100	80	90.00
\.


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grupos (id, codigo, ciclo_id, cupo_total, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inscripciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inscripciones (id, alumno_id, ciclo_id, status, created_at, referencia, importe_centavos, comprobante_path, comprobante_mime, comprobante_size, tipo, fecha_pago, alumno_is_ipn, comprobante_estudios_path, comprobante_estudios_mime, comprobante_estudios_size, comprobante_exencion_path, comprobante_exencion_mime, comprobante_exencion_size, validated_by_id, validated_at, validation_notes, rechazo_motivo, rechazada_at) FROM stdin;
17	21	16	rechazada	2025-09-06 14:35:28.977061-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/043db3d8cce04fb385eeeb47feb3f7a8.png	image/png	240682	11	2025-09-06 20:35:56.385251-06	Comprobante no corresponde al pago	Comprobante no corresponde al pago	\N
20	21	14	rechazada	2025-09-06 14:51:07.300168-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/a7d766739c81413b94c4f0ead88ed53c.png	image/png	2052824	11	2025-09-06 20:51:37.961759-06	Comprobante no corresponde al pago	Comprobante no corresponde al pago	\N
19	21	13	confirmada	2025-09-06 14:50:47.718309-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/0793055cc4504ce1a45c216de65542db.png	image/png	240682	11	2025-09-06 20:51:45.884814-06	\N	\N	\N
23	21	12	registrada	2025-09-06 14:54:22.687297-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/50be1d6f0c914edf993f1aab09faf258.png	image/png	57346	\N	\N	\N	\N	\N
24	21	14	confirmada	2025-09-06 14:56:43.458285-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/fde2ad2ed28c43bbb14566f00640d52d.png	image/png	57346	11	2025-09-06 20:57:13.373273-06	\N	\N	\N
26	16	16	confirmada	2025-09-06 15:37:56.137187-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/febae65248a5408cb792424527cc7092.png	image/png	57346	11	2025-09-06 21:38:51.352114-06	\N	\N	\N
27	22	15	confirmada	2025-09-06 15:51:38.492802-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/921a337b65444070a2c9690e86048b8b.png	image/png	1357460	11	2025-09-06 21:52:39.335388-06	\N	\N	\N
28	22	16	rechazada	2025-09-06 15:52:26.7171-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/33834a355ab44e25bf56d46be02c71c7.jpeg	image/jpeg	271298	11	2025-09-06 21:52:47.329595-06	Datos personales no coinciden	Datos personales no coinciden	\N
30	22	16	confirmada	2025-09-06 15:59:10.06663-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/b74723d82d5243288be9d70f542b16f2.jpeg	image/jpeg	26438	11	2025-09-06 22:02:21.745687-06	\N	\N	\N
31	23	15	registrada	2025-09-06 16:08:11.437858-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/b2f8c06134314e2e9bd274c353c383e1.jpeg	image/jpeg	271298	\N	\N	\N	\N	\N
32	23	16	rechazada	2025-09-06 16:17:58.1083-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/47c6677820dc42018206f4a4090360be.png	image/png	240682	11	2025-09-06 22:18:56.157027-06	Comprobante no corresponde al pago	Comprobante no corresponde al pago	\N
33	23	17	registrada	2025-09-06 16:22:27.46085-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/a785f2c904d84d40b532a16bab5f61bb.jpeg	image/jpeg	271298	\N	\N	\N	\N	\N
1	16	11	registrada	2025-08-31 14:21:22.495956-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
34	18	17	registrada	2025-09-06 16:22:59.242743-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/86a61da02d5d44e4a9060e37ae3fbc57.jpeg	image/jpeg	271298	\N	\N	\N	\N	\N
3	17	10	registrada	2025-08-31 17:57:16.837038-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	17	11	registrada	2025-08-31 17:57:48.622033-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	18	11	registrada	2025-08-31 18:54:40.27699-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	18	10	registrada	2025-08-31 18:54:43.401846-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	19	11	registrada	2025-08-31 19:35:29.879944-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	19	10	registrada	2025-08-31 19:35:33.06468-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9	20	11	registrada	2025-08-31 19:37:23.915801-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10	20	10	registrada	2025-08-31 19:37:26.725245-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
35	21	17	registrada	2025-09-06 16:24:36.131055-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/e0a1beddb8ee4bdfb59199d9e41b61a3.png	image/png	1362163	\N	\N	\N	\N	\N
14	16	15	confirmada	2025-09-06 12:34:01.905766-06	655645	135050	/home/vsalazar/celex/back-celex/uploads/comprobantes/24a08d9d977b46f68305f66f270b09c9.png	image/png	1357460	pago	2025-09-06	t	/home/vsalazar/celex/back-celex/uploads/estudios/de27a56a55144bbc815093241526b371.png	image/png	374354	\N	\N	\N	11	2025-09-06 18:35:05.11753-06	\N	\N	\N
12	16	13	rechazada	2025-08-31 20:55:44.769384-06	REFHA1258	136550	uploads/comprobantes/dea04d092da34cbbbc423619aca2e47d.png	image/png	2052824	pago	\N	f	\N	\N	\N	\N	\N	\N	11	2025-09-06 19:28:13.276053-06	Datos personales no coinciden hthththth	Datos personales no coinciden hthththth	\N
15	16	16	rechazada	2025-09-06 12:34:18.904763-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/4cfc2e1520c348e392d93700243c2da8.jpeg	image/jpeg	271298	11	2025-09-06 19:06:00.702406-06	Documentación incompleta	Documentación incompleta	\N
13	16	14	rechazada	2025-08-31 22:21:55.368117-06	ref 321	165850	uploads/comprobantes/6e943e0eea1943818b92e1e2b0dbd48b.jpg	image/jpeg	899253	pago	\N	f	\N	\N	\N	\N	\N	\N	11	2025-09-06 19:14:56.314295-06	Archivo ilegible gfgfgfgfg	Archivo ilegible gfgfgfgfg	\N
11	16	12	rechazada	2025-08-31 20:22:51.384293-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	11	2025-09-06 19:42:12.512018-06	Datos personales no coinciden  dffdsf  fsf ds fd	Datos personales no coinciden  dffdsf  fsf ds fd	\N
2	16	10	rechazada	2025-08-31 16:45:02.648053-06	\N	\N	\N	\N	\N	pago	\N	f	\N	\N	\N	\N	\N	\N	11	2025-09-06 19:56:23.959761-06	Datos personales no coinciden  ttrththrrht ht htr rhth t	Datos personales no coinciden  ttrththrrht ht htr rhth t	\N
16	21	15	confirmada	2025-09-06 14:33:13.429046-06	56465456	135025	/home/vsalazar/celex/back-celex/uploads/comprobantes/f71780a17d28452fbc0bd882f18e2522.png	image/png	1357460	pago	2025-09-05	t	/home/vsalazar/celex/back-celex/uploads/estudios/16891a8af5184719a2f01377adb7c841.png	image/png	374354	\N	\N	\N	11	2025-09-06 20:34:12.487817-06	\N	\N	\N
37	25	15	registrada	2025-09-13 16:47:03.437255-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/37ed13e8b5354103a0f7002c9a39c06f.png	image/png	57346	\N	\N	\N	\N	\N
36	16	20	confirmada	2025-09-13 14:29:55.516404-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/1e68adc06efc4287a9e4703e7c6ef6be.png	image/png	57346	11	2025-09-13 22:47:35.816438-06	\N	\N	\N
38	27	16	confirmada	2025-09-14 18:14:21.213115-06	dhgfh54	140000	/home/vsalazar/celex/back-celex/uploads/comprobantes/489e1cd11a51480fa507eb2ca3641dcf.png	image/png	57346	pago	2025-09-14	f	\N	\N	\N	\N	\N	\N	11	2025-09-15 00:14:34.345572-06	\N	\N	\N
39	28	16	confirmada	2025-09-14 18:24:06.127053-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/b768505b1c174e198249366bf9cc82a9.png	image/png	57346	11	2025-09-15 00:24:27.653964-06	\N	\N	\N
40	29	16	confirmada	2025-09-14 18:31:10.11908-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/df8550688a6c4c84866a325f528c97fc.png	image/png	57346	11	2025-09-15 00:31:21.616803-06	\N	\N	\N
41	30	16	confirmada	2025-09-14 18:52:43.042764-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/4725019c74a248e593a056a28534966a.png	image/png	1357460	11	2025-09-15 00:52:53.231433-06	\N	\N	\N
42	31	16	confirmada	2025-09-14 18:59:06.983742-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/f9b984785f5743ae8a0ea9a13a8a9059.png	image/png	1357460	11	2025-09-15 00:59:25.403085-06	\N	\N	\N
43	32	16	confirmada	2025-09-14 19:11:20.809318-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/ac868b0b0f544da4832aa9b71f042fe0.png	image/png	1357460	11	2025-09-15 01:11:32.339957-06	\N	\N	\N
44	33	16	confirmada	2025-09-14 20:15:52.164147-06	\N	\N	\N	\N	\N	exencion	\N	f	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/af008bbf0dfe4a8e88017a6c4966add8.png	image/png	57346	11	2025-09-15 02:16:04.853546-06	\N	\N	\N
45	16	21	confirmada	2025-09-16 10:48:43.4746-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/10dc9185e7e14094b6069e9d75c9e2f4.png	image/png	57346	11	2025-09-16 16:48:56.02092-06	\N	\N	\N
46	16	22	confirmada	2025-09-16 11:11:08.169-06	\N	\N	\N	\N	\N	exencion	\N	t	\N	\N	\N	/home/vsalazar/celex/back-celex/uploads/exenciones/07908115cd9f4ba5aa9d8d341a9127e8.png	image/png	114667	11	2025-09-16 17:11:38.045619-06	\N	\N	\N
\.


--
-- Data for Name: placement_exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.placement_exams (id, codigo, idioma, fecha, hora, salon, duracion_min, cupo_total, costo, docente_id, nombre, modalidad, nivel_objetivo, estado, instrucciones, link_registro, activo, insc_inicio, insc_fin) FROM stdin;
1	2025-DSD	ingles	2025-09-19	13:20:00	102	90	20	160	24	2025-DSD	\N	\N	borrador	hfghgf	\N	t	\N	\N
2	hgfhgfh	ingles	2025-09-13	12:22:00	\N	90	30	0	\N	hgfhgfh	\N	\N	borrador	\N	\N	t	\N	\N
3	4242342	ingles	2025-09-15	13:20:00	102	90	30	250	24	4242342	\N	\N	borrador	sdgdfgdfgfd	\N	t	\N	\N
4	arqa	frances	2025-09-12	14:32:00	\N	90	30	50	13	arqa	\N	\N	borrador	\N	\N	t	\N	\N
5	prueba	ingles	2025-09-12	17:43:00	101	90	30	200	24	prueba	\N	\N	borrador	yrtyrtytryrtyrty	\N	t	\N	\N
6	colocacion ed5	ingles	2025-09-12	19:04:00	107	90	30	520	24	colocacion ed5	\N	\N	borrador	fds sfdf d fdsdf sfsf fds  fsfdsf fsd  fsd fds sf f dfd fd f fds	\N	t	\N	\N
7	colocate	ingles	2025-09-12	21:07:00	100	90	30	100	24	colocate	\N	\N	borrador	dgfdgfdgdfgfdgdfgd	\N	t	\N	\N
8	martita	ingles	2025-09-20	10:34:00	113	90	30	300	24	martita	\N	\N	borrador	dsa sd dsa as ads sda sda ds dsa a sd ds dsaa sd ada dss da dsaas d s s da	\N	t	\N	\N
9	COLOCACION-1	ingles	2025-09-20	01:00:00	105	91	30	0	24	COLOCACION-1	\N	\N	borrador	HHBGGHHH  HHG GH GH GHG H HGF GH GG  GHFHG GFH	\N	t	\N	\N
12	miriam chichona	ingles	2025-09-27	15:31:00	102	90	30	150	24	miriam chichona	\N	\N	borrador	gsg  gsd g gsdggdsdsg	\N	t	2025-09-16	2025-09-20
\.


--
-- Data for Name: placement_registros; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.placement_registros (id, alumno_id, exam_id, status, referencia, importe_centavos, fecha_pago, comprobante_path, comprobante_mime, comprobante_size, created_at, rechazo_motivo, validation_notes, validated_by_id, validated_at, nivel_idioma) FROM stdin;
2	16	1	RECHAZADA	gggdfgfd	50000	2025-09-12	uploads/placement_pagos/33834a355ab44e25bf56d46be02c71c7.jpeg	image/jpeg	271298	2025-09-12 14:01:29.151729-06	\N	\N	\N	\N	\N
3	16	2	VALIDADA	rgfgdfdgfd	5000	2025-09-12	uploads/placement_pagos/b2f8c06134314e2e9bd274c353c383e1.jpeg	image/jpeg	271298	2025-09-12 14:19:32.967233-06	\N	\N	\N	\N	\N
4	16	4	VALIDADA	5435345	15000	2025-09-12	uploads/placement_pagos/comprobante_2.jpeg	image/jpeg	271298	2025-09-12 14:32:02.791495-06	\N	\N	\N	\N	\N
5	16	5	RECHAZADA	5435345	20000	2025-09-13	uploads/placement_pagos/archivo (1).png	image/png	57346	2025-09-12 17:43:34.869561-06	textoi del motivo del rechazo miriam chichona	textoi del motivo del rechazo miriam chichona	11	2025-09-12 17:44:07.144422-06	B1
1	16	3	CANCELADA	ututyuty	78000	2025-09-12	uploads/placement_pagos/33834a355ab44e25bf56d46be02c71c7.jpeg	image/jpeg	271298	2025-09-12 13:42:29.478764-06	\N	\N	\N	\N	BASICO
6	16	6	VALIDADA	ttetertetr	50000	2025-09-12	uploads/placement_pagos/archivo (1).png	image/png	57346	2025-09-12 19:04:26.388411-06	\N	\N	11	2025-09-12 19:05:01.063063-06	AVANZADO
7	16	7	RECHAZADA	treterter	10000	2025-09-12	uploads/placement_pagos/archivo (1).png	image/png	57346	2025-09-12 19:08:36.644342-06	sdf sd f fds sdffd ssfdfd	sdf sd f fds sdffd ssfdfd	11	2025-09-12 19:08:59.300591-06	INTERMEDIO
8	16	8	RECHAZADA	gfdgfdgfd	30000	2025-09-12	uploads/placement_pagos/archivo (1).png	image/png	57346	2025-09-13 10:37:06.012491-06	gdfgdgdfgdfg	gdfgdgdfgdfg	11	2025-09-13 10:38:04.823839-06	\N
10	16	12	VALIDADA	ewrewretre	50000	2025-09-17	uploads/placement_pagos/comprobante_2 (1).jpeg	image/jpeg	271298	2025-09-16 13:42:08.216609-06	\N	\N	11	2025-09-16 13:42:58.75437-06	\N
9	16	9	CANCELADA	rtytryrtyrt	50000	2025-09-09	uploads/placement_pagos/archivo (1).png	image/png	57346	2025-09-16 10:51:08.687581-06	\N	\N	\N	\N	\N
\.


--
-- Data for Name: survey_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_answers (id, response_id, question_id, value_int, value_bool, value_text, created_at) FROM stdin;
5	2	1	2	\N	\N	2025-09-13 19:09:15.574778-06
6	2	2	3	\N	\N	2025-09-13 19:09:15.574778-06
7	2	3	4	\N	\N	2025-09-13 19:09:15.574778-06
8	2	4	2	\N	\N	2025-09-13 19:09:15.574778-06
9	2	5	3	\N	\N	2025-09-13 19:09:15.574778-06
10	2	6	4	\N	\N	2025-09-13 19:09:15.574778-06
11	2	7	3	\N	\N	2025-09-13 19:09:15.574778-06
12	2	8	4	\N	\N	2025-09-13 19:09:15.574778-06
13	2	9	2	\N	\N	2025-09-13 19:09:15.574778-06
14	2	10	4	\N	\N	2025-09-13 19:09:15.574778-06
15	2	11	3	\N	\N	2025-09-13 19:09:15.574778-06
16	2	12	4	\N	\N	2025-09-13 19:09:15.574778-06
17	2	13	3	\N	\N	2025-09-13 19:09:15.574778-06
18	2	14	4	\N	\N	2025-09-13 19:09:15.574778-06
19	2	15	4	\N	\N	2025-09-13 19:09:15.574778-06
20	3	1	3	\N	\N	2025-09-14 18:15:16.723835-06
21	3	2	4	\N	\N	2025-09-14 18:15:16.723835-06
22	3	3	4	\N	\N	2025-09-14 18:15:16.723835-06
23	3	4	5	\N	\N	2025-09-14 18:15:16.723835-06
24	3	5	2	\N	\N	2025-09-14 18:15:16.723835-06
25	3	6	1	\N	\N	2025-09-14 18:15:16.723835-06
26	3	7	5	\N	\N	2025-09-14 18:15:16.723835-06
27	3	8	3	\N	\N	2025-09-14 18:15:16.723835-06
28	3	9	5	\N	\N	2025-09-14 18:15:16.723835-06
29	3	10	1	\N	\N	2025-09-14 18:15:16.723835-06
30	3	11	4	\N	\N	2025-09-14 18:15:16.723835-06
31	3	12	5	\N	\N	2025-09-14 18:15:16.723835-06
32	3	13	5	\N	\N	2025-09-14 18:15:16.723835-06
33	3	14	5	\N	\N	2025-09-14 18:15:16.723835-06
34	3	15	4	\N	\N	2025-09-14 18:15:16.723835-06
35	4	1	1	\N	\N	2025-09-14 18:25:02.926054-06
36	4	2	4	\N	\N	2025-09-14 18:25:02.926054-06
37	4	3	5	\N	\N	2025-09-14 18:25:02.926054-06
38	4	4	4	\N	\N	2025-09-14 18:25:02.926054-06
39	4	5	5	\N	\N	2025-09-14 18:25:02.926054-06
40	4	6	4	\N	\N	2025-09-14 18:25:02.926054-06
41	4	7	4	\N	\N	2025-09-14 18:25:02.926054-06
42	4	8	5	\N	\N	2025-09-14 18:25:02.926054-06
43	4	9	4	\N	\N	2025-09-14 18:25:02.926054-06
44	4	10	5	\N	\N	2025-09-14 18:25:02.926054-06
45	4	11	4	\N	\N	2025-09-14 18:25:02.926054-06
46	4	12	5	\N	\N	2025-09-14 18:25:02.926054-06
47	4	13	4	\N	\N	2025-09-14 18:25:02.926054-06
48	4	14	5	\N	\N	2025-09-14 18:25:02.926054-06
49	4	15	4	\N	\N	2025-09-14 18:25:02.926054-06
50	5	1	4	\N	\N	2025-09-14 18:48:09.464074-06
51	5	2	5	\N	\N	2025-09-14 18:48:09.464074-06
52	5	3	4	\N	\N	2025-09-14 18:48:09.464074-06
53	5	4	4	\N	\N	2025-09-14 18:48:09.464074-06
54	5	5	4	\N	\N	2025-09-14 18:48:09.464074-06
55	5	6	5	\N	\N	2025-09-14 18:48:09.464074-06
56	5	7	4	\N	\N	2025-09-14 18:48:09.464074-06
57	5	8	5	\N	\N	2025-09-14 18:48:09.464074-06
58	5	9	4	\N	\N	2025-09-14 18:48:09.464074-06
59	5	10	5	\N	\N	2025-09-14 18:48:09.464074-06
60	5	11	4	\N	\N	2025-09-14 18:48:09.464074-06
61	5	12	5	\N	\N	2025-09-14 18:48:09.464074-06
62	5	13	4	\N	\N	2025-09-14 18:48:09.464074-06
63	5	14	5	\N	\N	2025-09-14 18:48:09.464074-06
64	5	15	5	\N	\N	2025-09-14 18:48:09.464074-06
65	6	1	4	\N	\N	2025-09-14 18:53:24.991859-06
66	6	2	5	\N	\N	2025-09-14 18:53:24.991859-06
67	6	3	4	\N	\N	2025-09-14 18:53:24.991859-06
68	6	4	5	\N	\N	2025-09-14 18:53:24.991859-06
69	6	5	4	\N	\N	2025-09-14 18:53:24.991859-06
70	6	6	5	\N	\N	2025-09-14 18:53:24.991859-06
71	6	7	4	\N	\N	2025-09-14 18:53:24.991859-06
72	6	8	5	\N	\N	2025-09-14 18:53:24.991859-06
73	6	9	4	\N	\N	2025-09-14 18:53:24.991859-06
74	6	10	5	\N	\N	2025-09-14 18:53:24.991859-06
75	6	11	4	\N	\N	2025-09-14 18:53:24.991859-06
76	6	12	5	\N	\N	2025-09-14 18:53:24.991859-06
77	6	13	4	\N	\N	2025-09-14 18:53:24.991859-06
78	6	14	5	\N	\N	2025-09-14 18:53:24.991859-06
79	6	15	4	\N	\N	2025-09-14 18:53:24.991859-06
80	7	1	5	\N	\N	2025-09-14 19:00:05.90581-06
81	7	2	4	\N	\N	2025-09-14 19:00:05.90581-06
82	7	3	5	\N	\N	2025-09-14 19:00:05.90581-06
83	7	4	4	\N	\N	2025-09-14 19:00:05.90581-06
84	7	5	4	\N	\N	2025-09-14 19:00:05.90581-06
85	7	6	4	\N	\N	2025-09-14 19:00:05.90581-06
86	7	7	4	\N	\N	2025-09-14 19:00:05.90581-06
87	7	8	4	\N	\N	2025-09-14 19:00:05.90581-06
88	7	9	4	\N	\N	2025-09-14 19:00:05.90581-06
89	7	10	4	\N	\N	2025-09-14 19:00:05.90581-06
90	7	11	4	\N	\N	2025-09-14 19:00:05.90581-06
91	7	12	4	\N	\N	2025-09-14 19:00:05.90581-06
92	7	13	4	\N	\N	2025-09-14 19:00:05.90581-06
93	7	14	4	\N	\N	2025-09-14 19:00:05.90581-06
94	7	15	4	\N	\N	2025-09-14 19:00:05.90581-06
95	7	16	\N	\N	zzvvvcxvxcvxcvxvc    cvcvxcv x  cv  vc vc cvcxc xv	2025-09-14 19:00:05.90581-06
97	8	1	4	\N	\N	2025-09-14 19:14:11.169313-06
98	8	2	5	\N	\N	2025-09-14 19:14:11.169313-06
99	8	3	4	\N	\N	2025-09-14 19:14:11.169313-06
100	8	4	5	\N	\N	2025-09-14 19:14:11.169313-06
101	8	5	5	\N	\N	2025-09-14 19:14:11.169313-06
102	8	6	4	\N	\N	2025-09-14 19:14:11.169313-06
103	8	7	5	\N	\N	2025-09-14 19:14:11.169313-06
104	8	8	4	\N	\N	2025-09-14 19:14:11.169313-06
105	8	9	5	\N	\N	2025-09-14 19:14:11.169313-06
106	8	10	4	\N	\N	2025-09-14 19:14:11.169313-06
107	8	11	5	\N	\N	2025-09-14 19:14:11.169313-06
108	8	12	4	\N	\N	2025-09-14 19:14:11.169313-06
109	8	13	5	\N	\N	2025-09-14 19:14:11.169313-06
110	8	14	4	\N	\N	2025-09-14 19:14:11.169313-06
111	8	15	5	\N	\N	2025-09-14 19:14:11.169313-06
112	8	16	\N	\N	ggfd gf g  gdf  g gfd  gfd fgd gfdg fdf fg gfg fgf gfdfgdg df gdf gfd gfd gdf df fgd fgd gfd gfd fdg gfd gfd gfg fgf  gd fd  fdg fgddf	2025-09-14 19:14:11.169313-06
113	9	1	4	\N	\N	2025-09-14 20:16:40.291937-06
114	9	2	5	\N	\N	2025-09-14 20:16:40.291937-06
115	9	3	2	\N	\N	2025-09-14 20:16:40.291937-06
116	9	4	2	\N	\N	2025-09-14 20:16:40.291937-06
117	9	5	2	\N	\N	2025-09-14 20:16:40.291937-06
118	9	6	2	\N	\N	2025-09-14 20:16:40.291937-06
119	9	7	1	\N	\N	2025-09-14 20:16:40.291937-06
120	9	8	2	\N	\N	2025-09-14 20:16:40.291937-06
121	9	9	2	\N	\N	2025-09-14 20:16:40.291937-06
122	9	10	3	\N	\N	2025-09-14 20:16:40.291937-06
123	9	11	2	\N	\N	2025-09-14 20:16:40.291937-06
124	9	12	3	\N	\N	2025-09-14 20:16:40.291937-06
125	9	13	4	\N	\N	2025-09-14 20:16:40.291937-06
126	9	14	3	\N	\N	2025-09-14 20:16:40.291937-06
127	9	15	2	\N	\N	2025-09-14 20:16:40.291937-06
128	9	16	\N	\N	este es un cometario de prueba	2025-09-14 20:16:40.291937-06
\.


--
-- Data for Name: survey_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_categories (id, name, description, "order", active, created_at) FROM stdin;
1	General		1	t	2025-09-13 14:16:12.847909-06
2	Autoevaluacion		2	t	2025-09-13 14:16:20.35371-06
3	Del profesor		3	t	2025-09-13 18:57:17.774067-06
36	Del curso		4	t	2025-09-13 19:01:01.071063-06
\.


--
-- Data for Name: survey_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_questions (id, category_id, text, help_text, type, required, active, "order", created_at) FROM stdin;
1	1	El curso cumplió con tus expectativas.		likert_1_5	t	t	1	2025-09-13 14:16:31.092939-06
3	1	El curso aportó a tu aprendizaje del idioma.		likert_1_5	t	t	3	2025-09-13 14:16:45.964308-06
2	1	Se te facilitó tomar el curso en la modalidad que elegiste		likert_1_5	t	t	2	2025-09-13 14:16:38.443063-06
4	1	Te fue fácil realizar los exámenes, ya sea en papel (grupos presenciales) o en plataforma (grupos remotos).		likert_1_5	t	t	4	2025-09-13 14:16:52.928582-06
5	2	Asististe puntualmente a todas las sesiones		likert_1_5	t	t	1	2025-09-13 19:04:04.466943-06
6	2	Realizaste todas las actividades que te encomendó tu profesor(a)		likert_1_5	t	t	2	2025-09-13 19:04:20.794787-06
7	2	Utilizaste los materiales (libro, cuaderno de trabajo, etc.) que te solicitaron en clase		likert_1_5	t	t	3	2025-09-13 19:04:37.147434-06
8	3	El profesor utilizó estrategias de enseñanza que estimularon tu aprendizaje		likert_1_5	t	t	1	2025-09-13 19:04:57.616393-06
9	3	El profesor atendió tus dudas oportunamente		likert_1_5	t	t	2	2025-09-13 19:05:09.277361-06
10	3	La retroalimentación a tus tareas y trabajos por parte de l(a) profesor(a) fue apropiada		likert_1_5	t	t	3	2025-09-13 19:05:30.494727-06
11	36	Los contenidos del curso se presentaron de una manera comprensible		likert_1_5	t	t	1	2025-09-13 19:05:59.418092-06
12	36	Existió equilibrio entre los contenidos teóricos y prácticos		likert_1_5	t	t	2	2025-09-13 19:06:17.255976-06
13	36	La duración del curso fue la adecuada para cubrir los contenidos expuestos		likert_1_5	t	t	3	2025-09-13 19:06:31.313865-06
14	36	Los criterios de evaluación fueron claros y entendibles		likert_1_5	t	t	4	2025-09-13 19:06:50.449542-06
15	36	Te sientes preparado(a) para el siguiente nivel		likert_1_5	t	t	5	2025-09-13 19:07:07.932672-06
16	1	Comentarios y sugerencias	\N	open_text	f	t	999	2025-09-14 18:56:03.732969-06
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_responses (id, inscripcion_id, ciclo_id, alumno_id, created_at, comments) FROM stdin;
2	26	16	16	2025-09-13 19:09:15.574778-06	\N
3	38	16	27	2025-09-14 18:15:16.723835-06	\N
4	39	16	28	2025-09-14 18:25:02.926054-06	\N
5	40	16	29	2025-09-14 18:48:09.464074-06	\N
6	41	16	30	2025-09-14 18:53:24.991859-06	\N
7	42	16	31	2025-09-14 19:00:05.90581-06	\N
8	43	16	32	2025-09-14 19:14:11.169313-06	\N
9	44	16	33	2025-09-14 20:16:40.291937-06	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, last_name, email, email_verified, hashed_password, is_ipn, boleta, curp, role, is_active, created_at, updated_at, telefono, addr_calle, addr_numero, addr_colonia, addr_municipio, addr_estado, addr_cp, ipn_nivel, ipn_unidad, tutor_telefono) FROM stdin;
1	Vidal	Salazar Sanchez	vsalazars@ipn.mx	t	$2b$12$1xmDbDA7Jsljg6K1dBGBnua51TY7e9USZ9oyB.zLegdbyQ0aqLaZ2	f	\N	SASV811104HMCLND02	superuser	t	2025-08-23 23:38:52.634036-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
13	Martha	Gomez	culona@mail.com	f	$2b$12$oJ9yPc6fESLwjfwJGMBicuNGa6GKW7cmS6AkYCqqswdEJ7nrcRMP.	f	\N	SASV811104HMCLND06	teacher	f	2025-08-24 22:10:59.375534-06	2025-08-24 22:14:05.822115-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
14	Fer	Lopez	fer@mail.com	f	$2b$12$aph6ob2xn688xxO9zJBOq.98cJ.Dl1G7Eiu/H1gXdBlmSamTy9F3O	f	\N	SASV811104HMCLND07	teacher	f	2025-08-24 22:15:23.689888-06	2025-08-24 22:23:28.222851-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
15	Ara	Zenteno	araq@mail.com	t	$2b$12$szx6dIksqN6csseOSjB.kOSlIHn/SoLNf49yxCJ0Q05bJ0Fmt8OlK	f	\N	SASV811104HMCLND04	teacher	t	2025-08-27 16:14:59.868613-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11	Miriam	Escudero López	carlos.martinez_delacruz@yahoo.com	t	$2b$12$Vwc8MuT7fPV5LK4z/OuY0.4XpMaVO5gx.FuQwC8N5njyo8gdXDoQS	f	\N	SASV811104HMCLND08	coordinator	t	2025-08-24 19:42:57.689569-06	2025-08-27 20:18:21.433688-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
17	Martha	Culona	marta@mail.com	f	$2b$12$IAWeSVXH3XNISXPyvJDyseTUrK7grnw.PQfwrZO1GTbuOyESWKeoW	t	2026140109	SASV811104HMCLND03	student	t	2025-08-31 17:55:57.927054-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
18	Areli	Nalgo	areli@mail.com	f	$2b$12$vH3nU09L6bGuQXwuYBLsjOKrodxjBp/nIslllgezKIkaXk98XYHZq	f	\N	SASV811104HMCLND21	student	t	2025-08-31 18:54:19.26021-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
19	Carlos Eduardo	Martínez de la Cruz	carlos@mail.com	f	$2b$12$hzCZFEWdVN6GWJvAxcxBW.JEyGRIuICr48eNEn68VFM/NNeXzEuwG	f	\N	SASV811104HMCLND22	student	t	2025-08-31 19:34:45.912325-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
20	Carlos Eduardo	Martínez de la Cruz	carlos2@mail.com	f	$2b$12$V8a7koXg1ZVxA/QF0IpVlu46pChOUwRLy5CwAIy8A7hbZbJmDz4Cq	t	2025087898	SASV811104HMCLND23	student	t	2025-08-31 19:37:06.603383-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
21	alumno1	alumno1	alumno1@mail.com	f	$2b$12$qXnr0WVJqpD/YYzjC2kaBOPUWF2WJJGqgWBQafLgn7iRcuGVKmyFi	t	2023666565	SASV811104HMCLND30	student	t	2025-09-06 14:32:26.015806-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
22	miriam	escudero	miriam@mail.com	f	$2b$12$2rPGH3RRLhbnrMWrsfdUoemp1e.rptVEYezNLYF3Lm.BIYoPr7aZ.	f	\N	SASV811104HMCLND31	student	t	2025-09-06 15:48:59.056555-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
23	ara	zenteno	araceli@mail.com	f	$2b$12$c64qwGTth7.T2byZHYlPx.b/R.XMvsY6bpI1jF43g7Km45P.Eq3IO	f	\N	SASV811104HMCLND32	student	t	2025-09-06 16:07:45.123736-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
24	PAty	Nalgas	capacitacion.technopoli@gmail.com	t	$2b$12$rQH6hGXL1RIU3AI2JQmZi.DfWcRu//qPnxjhSaLUphPe26OFpWOW2	f	\N	SASV811104HMCLND33	teacher	t	2025-09-06 16:45:08.895155-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
12	Araceli	Zenteno Tetona	ara@mail.com	t	$2b$12$Z32/dD.PcXtw5KttagkTtOVCT7HVXJHgwcjsTuKljfdTdUjG0yWdy	f	\N	SASV811104HMCLND05	coordinator	t	2025-08-24 21:49:03.638271-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
32	carmen	carmen	carmen@mail.com	f	$2b$12$25XY0b.VX9pvbWc/ITGoHOr.7R4M4HT/BOmQ4OJRhzbmIf1ly7ZvG	f	\N	SASV811104HMCLNG02	student	t	2025-09-14 19:10:53.943745-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
25	a1	alumno1	a1@mail.com	f	$2b$12$NuOJBZc168TEMcd5S/mz0uOxX2p91ZqKiLBlZvEvID0o4ivxqt8Yy	f	\N	SASV811104HMCLND38	student	t	2025-09-13 16:46:23.922288-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
26	Miriam	Escudero	miri@mail.com	t	$2b$12$870BVLFqiId02RwWWSCgNO/yIHhZBPOnWzcUVFqjWwMm0gXUpgU5q	f	\N	SASV811104HMXLND34	teacher	t	2025-09-14 14:41:38.050611-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
27	Gonzo	Gonzalez	gonzo@mail.com	f	$2b$12$pKx4eTXZsvyFarxlEXXk3evqFr0zI8LqiVV0qGfH.lNgBIsmzvam2	f	\N	SASV811104MMCLND02	student	t	2025-09-14 18:12:45.427441-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
28	Lorena	Culona	lore@mail.com	f	$2b$12$IEgS6CkcM05J43ngWhp15eLzmj.2Zd5yO4wFFgWSOaAPk1J8IFuKy	f	\N	SASV811104HMCLNC02	student	t	2025-09-14 18:23:22.840399-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
29	Elizabeth	Benitez	eli@mail.com	f	$2b$12$YUHnGzdcTDKkm60O4.bfGuPEXvlu2AkjCtsangZePrRFWLBvU4j36	f	\N	SASV811104HMCLNE02	student	t	2025-09-14 18:30:41.872553-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
30	yeni	velia	yeni@mail.com	f	$2b$12$hLdmYiF9tucKLJC6eNBk3e.pgEAS9wVMyllnAIFgbpTlrQeJ70WAO	f	\N	SASV811104HMCLNV02	student	t	2025-09-14 18:52:22.429959-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
31	luisl	liis	luis@mail.com	f	$2b$12$lq3qDCu/2FCm7TdJS9bQn.BNkbU6W1rli4aCT56Obohnt6IMl0Ku.	f	\N	SASV811104HMCLNR02	student	t	2025-09-14 18:58:35.604721-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
33	nancy	camacho	nancy@mail.com	f	$2b$12$cfDQtaRNFCGbeBYJaWZ40eMXdMLTp5WeVcBFf.hGukWPD6lQ478eS	f	\N	SASV811104HMCLNK02	student	t	2025-09-14 20:15:20.327112-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
34	noipn	deprueaba	noipn@mail.com	f	$2b$12$1bFQzVabuILYVWIQDpkFFO/b6qmEzwJxTaz0WkJDkobdyJPf8NsPW	f	\N	SASV811104HMCLNW02	student	t	2025-09-16 14:50:17.065225-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
35	ipn	menoredad	menor@mail.com	f	$2b$12$vB.890nU0DJpqFbayUtXeeCsQWD9q1g12PW84DCgRtfRXWbgbApPO	t	2024100020	SASV091104HMCLND02	student	t	2025-09-16 14:53:40.238814-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
36	menor	noipn	menornoipn@mail.com	f	$2b$12$2khi7Mm0Ab1.p6bcGjrqGep.O34/VVgqlsTevO9s93zoFbGWcoZLa	f	\N	SASV091104HMCLND05	student	t	2025-09-16 14:57:18.461475-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
16	Lia Romina Nazareth	Salazar Sánchez	vidalsalazarsanchez@gmail.com	f	$2b$12$...QUEVEXCVV43XbDaY48uziY8iqQ8HVA1GE2eFCEjbrW/XJ9H9T2	t	2025087898	SASV811104HMCLND09	student	t	2025-08-28 18:10:41.151123-06	2025-09-16 19:13:36.05549-06	5532354608	norte 22	4121	Sanchez 3a seccion	gustavo a madero	ciudad de mexico	07839	Medio superior	CECyT 15	\N
\.


--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencia_registro_id_seq', 35, true);


--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencia_sesion_id_seq', 4430, true);


--
-- Name: ciclos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ciclos_id_seq', 22, true);


--
-- Name: evaluaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.evaluaciones_id_seq', 6, true);


--
-- Name: grupos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grupos_id_seq', 1, false);


--
-- Name: inscripciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inscripciones_id_seq', 46, true);


--
-- Name: placement_exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.placement_exams_id_seq', 12, true);


--
-- Name: placement_registros_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.placement_registros_id_seq', 10, true);


--
-- Name: survey_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_answers_id_seq', 128, true);


--
-- Name: survey_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_categories_id_seq', 36, true);


--
-- Name: survey_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_questions_id_seq', 17, true);


--
-- Name: survey_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_responses_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 36, true);


--
-- Name: asistencia_registro asistencia_registro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_pkey PRIMARY KEY (id);


--
-- Name: asistencia_sesion asistencia_sesion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT asistencia_sesion_pkey PRIMARY KEY (id);


--
-- Name: ciclos ciclos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT ciclos_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_inscripcion_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_inscripcion_id_key UNIQUE (inscripcion_id);


--
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_unq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_unq UNIQUE (inscripcion_id, ciclo_id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (id);


--
-- Name: placement_exams placement_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT placement_exams_pkey PRIMARY KEY (id);


--
-- Name: placement_registros placement_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_pkey PRIMARY KEY (id);


--
-- Name: survey_answers survey_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_pkey PRIMARY KEY (id);


--
-- Name: survey_categories survey_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_categories
    ADD CONSTRAINT survey_categories_pkey PRIMARY KEY (id);


--
-- Name: survey_questions survey_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: placement_registros uq_alumno_exam; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT uq_alumno_exam UNIQUE (alumno_id, exam_id);


--
-- Name: asistencia_registro uq_asistencia_registro_sesion_inscripcion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT uq_asistencia_registro_sesion_inscripcion UNIQUE (sesion_id, inscripcion_id);


--
-- Name: asistencia_sesion uq_asistencia_sesion_ciclo_fecha; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT uq_asistencia_sesion_ciclo_fecha UNIQUE (ciclo_id, fecha);


--
-- Name: ciclos uq_ciclos_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT uq_ciclos_codigo UNIQUE (codigo);


--
-- Name: grupos uq_grupos_ciclo_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT uq_grupos_ciclo_codigo UNIQUE (ciclo_id, codigo);


--
-- Name: placement_exams uq_placement_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT uq_placement_codigo UNIQUE (codigo);


--
-- Name: survey_answers uq_survey_answer_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT uq_survey_answer_unique UNIQUE (response_id, question_id);


--
-- Name: survey_responses uq_survey_response_inscripcion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT uq_survey_response_inscripcion UNIQUE (inscripcion_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_evaluaciones_ciclo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluaciones_ciclo ON public.evaluaciones USING btree (ciclo_id);


--
-- Name: idx_evaluaciones_inscripcion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluaciones_inscripcion ON public.evaluaciones USING btree (inscripcion_id);


--
-- Name: idx_placement_exams_insc_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_placement_exams_insc_window ON public.placement_exams USING btree (insc_inicio, insc_fin);


--
-- Name: ix_asistencia_registro_inscripcion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_inscripcion ON public.asistencia_registro USING btree (inscripcion_id);


--
-- Name: ix_asistencia_registro_inscripcion_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_inscripcion_id ON public.asistencia_registro USING btree (inscripcion_id);


--
-- Name: ix_asistencia_registro_sesion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_sesion ON public.asistencia_registro USING btree (sesion_id);


--
-- Name: ix_asistencia_registro_sesion_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_sesion_id ON public.asistencia_registro USING btree (sesion_id);


--
-- Name: ix_asistencia_sesion_ciclo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_sesion_ciclo ON public.asistencia_sesion USING btree (ciclo_id);


--
-- Name: ix_asistencia_sesion_ciclo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_sesion_ciclo_id ON public.asistencia_sesion USING btree (ciclo_id);


--
-- Name: ix_asistencia_sesion_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_sesion_fecha ON public.asistencia_sesion USING btree (fecha);


--
-- Name: ix_ciclos_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ciclos_id ON public.ciclos USING btree (id);


--
-- Name: ix_grupos_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_grupos_id ON public.grupos USING btree (id);


--
-- Name: ix_inscripciones_alumno_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_inscripciones_alumno_id ON public.inscripciones USING btree (alumno_id);


--
-- Name: ix_inscripciones_ciclo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_inscripciones_ciclo_id ON public.inscripciones USING btree (ciclo_id);


--
-- Name: ix_inscripciones_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_inscripciones_created_at ON public.inscripciones USING btree (created_at);


--
-- Name: ix_inscripciones_fecha_pago; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_inscripciones_fecha_pago ON public.inscripciones USING btree (fecha_pago);


--
-- Name: ix_inscripciones_validated_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_inscripciones_validated_by_id ON public.inscripciones USING btree (validated_by_id);


--
-- Name: ix_placement_exams_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_exams_codigo ON public.placement_exams USING btree (codigo);


--
-- Name: ix_placement_exams_docente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_exams_docente_id ON public.placement_exams USING btree (docente_id);


--
-- Name: ix_placement_exams_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_exams_id ON public.placement_exams USING btree (id);


--
-- Name: ix_placement_exams_idioma; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_exams_idioma ON public.placement_exams USING btree (idioma);


--
-- Name: ix_placement_exams_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_exams_nombre ON public.placement_exams USING btree (nombre);


--
-- Name: ix_placement_registros_alumno_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_registros_alumno_id ON public.placement_registros USING btree (alumno_id);


--
-- Name: ix_placement_registros_exam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_registros_exam_id ON public.placement_registros USING btree (exam_id);


--
-- Name: ix_placement_registros_nivel_idioma; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_placement_registros_nivel_idioma ON public.placement_registros USING btree (nivel_idioma);


--
-- Name: ix_survey_answers_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_answers_id ON public.survey_answers USING btree (id);


--
-- Name: ix_survey_answers_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_answers_question_id ON public.survey_answers USING btree (question_id);


--
-- Name: ix_survey_answers_response_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_answers_response_id ON public.survey_answers USING btree (response_id);


--
-- Name: ix_survey_categories_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_categories_id ON public.survey_categories USING btree (id);


--
-- Name: ix_survey_questions_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_questions_category_id ON public.survey_questions USING btree (category_id);


--
-- Name: ix_survey_questions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_questions_id ON public.survey_questions USING btree (id);


--
-- Name: ix_survey_responses_alumno_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_responses_alumno_id ON public.survey_responses USING btree (alumno_id);


--
-- Name: ix_survey_responses_ciclo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_responses_ciclo_id ON public.survey_responses USING btree (ciclo_id);


--
-- Name: ix_survey_responses_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_responses_id ON public.survey_responses USING btree (id);


--
-- Name: ix_survey_responses_inscripcion_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_survey_responses_inscripcion_id ON public.survey_responses USING btree (inscripcion_id);


--
-- Name: ix_users_curp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_curp ON public.users USING btree (curp);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ux_insc_activa_alumno_ciclo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_insc_activa_alumno_ciclo ON public.inscripciones USING btree (alumno_id, ciclo_id) WHERE ((status)::text = ANY ((ARRAY['registrada'::character varying, 'preinscrita'::character varying, 'confirmada'::character varying])::text[]));


--
-- Name: evaluaciones trg_evaluaciones_timestamps; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_evaluaciones_timestamps BEFORE INSERT OR UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.ensure_timestamps();


--
-- Name: evaluaciones trg_evaluaciones_totales; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_evaluaciones_totales BEFORE INSERT OR UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.evaluaciones_autocalcula_totales();


--
-- Name: evaluaciones trg_evaluaciones_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_evaluaciones_updated_at BEFORE UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asistencia_registro asistencia_registro_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro asistencia_registro_marcado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_marcado_por_id_fkey FOREIGN KEY (marcado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_registro asistencia_registro_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.asistencia_sesion(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_registro fk_asistencia_registro_inscripcion; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro fk_asistencia_registro_sesion; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_sesion FOREIGN KEY (sesion_id) REFERENCES public.asistencia_sesion(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro fk_asistencia_registro_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_user FOREIGN KEY (marcado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_sesion fk_asistencia_sesion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT fk_asistencia_sesion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: ciclos fk_ciclos_docente; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT fk_ciclos_docente FOREIGN KEY (docente_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: evaluaciones fk_evaluacion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_inscripcion; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_user FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inscripciones fk_inscripciones_validated_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT fk_inscripciones_validated_by_id_users FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grupos grupos_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_validated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_validated_by_id_fkey FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: placement_exams placement_exams_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT placement_exams_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: placement_registros placement_registros_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: placement_registros placement_registros_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.placement_exams(id) ON DELETE CASCADE;


--
-- Name: placement_registros placement_registros_validated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_validated_by_id_fkey FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: survey_answers survey_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON DELETE CASCADE;


--
-- Name: survey_answers survey_answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;


--
-- Name: survey_questions survey_questions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.survey_categories(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

