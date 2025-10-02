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

--
-- Name: asistencia_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asistencia_estado AS ENUM (
    'presente',
    'ausente',
    'retardo',
    'justificado',
    'asistio',
    'falto',
    'tarde'
);


--
-- Name: diasemana; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: idioma; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.idioma AS ENUM (
    'ingles',
    'frances',
    'aleman',
    'italiano',
    'portugues'
);


--
-- Name: inscripcion_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inscripcion_tipo AS ENUM (
    'pago',
    'exencion'
);


--
-- Name: inscripciontipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inscripciontipo AS ENUM (
    'pago',
    'exencion'
);


--
-- Name: modalidad; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modalidad AS ENUM (
    'intensivo',
    'sabatino',
    'semestral'
);


--
-- Name: modalidad_asistencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modalidad_asistencia AS ENUM (
    'presencial',
    'virtual'
);


--
-- Name: modalidadasistencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modalidadasistencia AS ENUM (
    'presencial',
    'virtual'
);


--
-- Name: nivel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nivel AS ENUM (
    'INTRO',
    'B1',
    'B2',
    'B3',
    'B4',
    'B5',
    'I1',
    'I2',
    'I3',
    'I4',
    'I5',
    'A1',
    'A2',
    'A3',
    'A4',
    'A5',
    'A6'
);


--
-- Name: placementregistrostatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.placementregistrostatus AS ENUM (
    'PREINSCRITA',
    'VALIDADA',
    'RECHAZADA',
    'CANCELADA'
);


--
-- Name: turno; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.turno AS ENUM (
    'matutino',
    'vespertino',
    'mixto'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'student',
    'teacher',
    'coordinator',
    'superuser'
);


--
-- Name: ensure_timestamps(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: evaluaciones_autocalcula_totales(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asistencia_registro; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencia_registro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencia_registro_id_seq OWNED BY public.asistencia_registro.id;


--
-- Name: asistencia_sesion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencia_sesion (
    id integer NOT NULL,
    ciclo_id integer NOT NULL,
    fecha date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencia_sesion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencia_sesion_id_seq OWNED BY public.asistencia_sesion.id;


--
-- Name: ciclos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ciclos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ciclos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ciclos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ciclos_id_seq OWNED BY public.ciclos.id;


--
-- Name: encuesta_docente_respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encuesta_docente_respuestas (
    id integer NOT NULL,
    docente_id integer NOT NULL,
    ciclo_id integer,
    grupo_id integer,
    valor integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_encresp_valor_1_5 CHECK (((valor >= 1) AND (valor <= 5)))
);


--
-- Name: encuesta_docente_respuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.encuesta_docente_respuestas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encuesta_docente_respuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.encuesta_docente_respuestas_id_seq OWNED BY public.encuesta_docente_respuestas.id;


--
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluaciones_id_seq OWNED BY public.evaluaciones.id;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grupos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grupos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grupos_id_seq OWNED BY public.grupos.id;


--
-- Name: inscripciones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: inscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inscripciones_id_seq OWNED BY public.inscripciones.id;


--
-- Name: placement_exams; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: placement_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.placement_exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: placement_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.placement_exams_id_seq OWNED BY public.placement_exams.id;


--
-- Name: placement_registros; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: placement_registros_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.placement_registros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: placement_registros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.placement_registros_id_seq OWNED BY public.placement_registros.id;


--
-- Name: survey_answers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: survey_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.survey_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: survey_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.survey_answers_id_seq OWNED BY public.survey_answers.id;


--
-- Name: survey_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    "order" integer NOT NULL,
    active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: survey_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.survey_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: survey_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.survey_categories_id_seq OWNED BY public.survey_categories.id;


--
-- Name: survey_questions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: survey_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.survey_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: survey_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.survey_questions_id_seq OWNED BY public.survey_questions.id;


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    alumno_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comments text
);


--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.survey_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: survey_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.survey_responses_id_seq OWNED BY public.survey_responses.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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
    tutor_telefono character varying(20),
    tutor_nombre character varying(120),
    tutor_parentesco character varying(50)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: asistencia_registro id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro ALTER COLUMN id SET DEFAULT nextval('public.asistencia_registro_id_seq'::regclass);


--
-- Name: asistencia_sesion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_sesion ALTER COLUMN id SET DEFAULT nextval('public.asistencia_sesion_id_seq'::regclass);


--
-- Name: ciclos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos ALTER COLUMN id SET DEFAULT nextval('public.ciclos_id_seq'::regclass);


--
-- Name: encuesta_docente_respuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuesta_docente_respuestas ALTER COLUMN id SET DEFAULT nextval('public.encuesta_docente_respuestas_id_seq'::regclass);


--
-- Name: evaluaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_id_seq'::regclass);


--
-- Name: grupos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id SET DEFAULT nextval('public.grupos_id_seq'::regclass);


--
-- Name: inscripciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones ALTER COLUMN id SET DEFAULT nextval('public.inscripciones_id_seq'::regclass);


--
-- Name: placement_exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_exams ALTER COLUMN id SET DEFAULT nextval('public.placement_exams_id_seq'::regclass);


--
-- Name: placement_registros id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros ALTER COLUMN id SET DEFAULT nextval('public.placement_registros_id_seq'::regclass);


--
-- Name: survey_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_answers ALTER COLUMN id SET DEFAULT nextval('public.survey_answers_id_seq'::regclass);


--
-- Name: survey_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_categories ALTER COLUMN id SET DEFAULT nextval('public.survey_categories_id_seq'::regclass);


--
-- Name: survey_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_questions ALTER COLUMN id SET DEFAULT nextval('public.survey_questions_id_seq'::regclass);


--
-- Name: survey_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses ALTER COLUMN id SET DEFAULT nextval('public.survey_responses_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: asistencia_registro asistencia_registro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_pkey PRIMARY KEY (id);


--
-- Name: asistencia_sesion asistencia_sesion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT asistencia_sesion_pkey PRIMARY KEY (id);


--
-- Name: ciclos ciclos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT ciclos_pkey PRIMARY KEY (id);


--
-- Name: encuesta_docente_respuestas encuesta_docente_respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuesta_docente_respuestas
    ADD CONSTRAINT encuesta_docente_respuestas_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_inscripcion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_inscripcion_id_key UNIQUE (inscripcion_id);


--
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_unq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_unq UNIQUE (inscripcion_id, ciclo_id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (id);


--
-- Name: placement_exams placement_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT placement_exams_pkey PRIMARY KEY (id);


--
-- Name: placement_registros placement_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_pkey PRIMARY KEY (id);


--
-- Name: survey_answers survey_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_pkey PRIMARY KEY (id);


--
-- Name: survey_categories survey_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_categories
    ADD CONSTRAINT survey_categories_pkey PRIMARY KEY (id);


--
-- Name: survey_questions survey_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: placement_registros uq_alumno_exam; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT uq_alumno_exam UNIQUE (alumno_id, exam_id);


--
-- Name: asistencia_registro uq_asistencia_registro_sesion_inscripcion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT uq_asistencia_registro_sesion_inscripcion UNIQUE (sesion_id, inscripcion_id);


--
-- Name: asistencia_sesion uq_asistencia_sesion_ciclo_fecha; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT uq_asistencia_sesion_ciclo_fecha UNIQUE (ciclo_id, fecha);


--
-- Name: ciclos uq_ciclos_codigo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT uq_ciclos_codigo UNIQUE (codigo);


--
-- Name: grupos uq_grupos_ciclo_codigo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT uq_grupos_ciclo_codigo UNIQUE (ciclo_id, codigo);


--
-- Name: placement_exams uq_placement_codigo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT uq_placement_codigo UNIQUE (codigo);


--
-- Name: survey_answers uq_survey_answer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT uq_survey_answer_unique UNIQUE (response_id, question_id);


--
-- Name: survey_responses uq_survey_response_inscripcion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT uq_survey_response_inscripcion UNIQUE (inscripcion_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_evaluaciones_ciclo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluaciones_ciclo ON public.evaluaciones USING btree (ciclo_id);


--
-- Name: idx_evaluaciones_inscripcion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluaciones_inscripcion ON public.evaluaciones USING btree (inscripcion_id);


--
-- Name: idx_placement_exams_insc_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_exams_insc_window ON public.placement_exams USING btree (insc_inicio, insc_fin);


--
-- Name: ix_asistencia_registro_inscripcion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_registro_inscripcion ON public.asistencia_registro USING btree (inscripcion_id);


--
-- Name: ix_asistencia_registro_inscripcion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_registro_inscripcion_id ON public.asistencia_registro USING btree (inscripcion_id);


--
-- Name: ix_asistencia_registro_sesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_registro_sesion ON public.asistencia_registro USING btree (sesion_id);


--
-- Name: ix_asistencia_registro_sesion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_registro_sesion_id ON public.asistencia_registro USING btree (sesion_id);


--
-- Name: ix_asistencia_sesion_ciclo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_sesion_ciclo ON public.asistencia_sesion USING btree (ciclo_id);


--
-- Name: ix_asistencia_sesion_ciclo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_sesion_ciclo_id ON public.asistencia_sesion USING btree (ciclo_id);


--
-- Name: ix_asistencia_sesion_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_sesion_fecha ON public.asistencia_sesion USING btree (fecha);


--
-- Name: ix_ciclos_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ciclos_id ON public.ciclos USING btree (id);


--
-- Name: ix_encuesta_docente_respuestas_ciclo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_encuesta_docente_respuestas_ciclo_id ON public.encuesta_docente_respuestas USING btree (ciclo_id);


--
-- Name: ix_encuesta_docente_respuestas_docente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_encuesta_docente_respuestas_docente_id ON public.encuesta_docente_respuestas USING btree (docente_id);


--
-- Name: ix_encuesta_docente_respuestas_grupo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_encuesta_docente_respuestas_grupo_id ON public.encuesta_docente_respuestas USING btree (grupo_id);


--
-- Name: ix_encuesta_docente_respuestas_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_encuesta_docente_respuestas_id ON public.encuesta_docente_respuestas USING btree (id);


--
-- Name: ix_grupos_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grupos_id ON public.grupos USING btree (id);


--
-- Name: ix_inscripciones_alumno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inscripciones_alumno_id ON public.inscripciones USING btree (alumno_id);


--
-- Name: ix_inscripciones_ciclo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inscripciones_ciclo_id ON public.inscripciones USING btree (ciclo_id);


--
-- Name: ix_inscripciones_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inscripciones_created_at ON public.inscripciones USING btree (created_at);


--
-- Name: ix_inscripciones_fecha_pago; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inscripciones_fecha_pago ON public.inscripciones USING btree (fecha_pago);


--
-- Name: ix_inscripciones_validated_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inscripciones_validated_by_id ON public.inscripciones USING btree (validated_by_id);


--
-- Name: ix_placement_exams_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_exams_codigo ON public.placement_exams USING btree (codigo);


--
-- Name: ix_placement_exams_docente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_exams_docente_id ON public.placement_exams USING btree (docente_id);


--
-- Name: ix_placement_exams_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_exams_id ON public.placement_exams USING btree (id);


--
-- Name: ix_placement_exams_idioma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_exams_idioma ON public.placement_exams USING btree (idioma);


--
-- Name: ix_placement_exams_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_exams_nombre ON public.placement_exams USING btree (nombre);


--
-- Name: ix_placement_registros_alumno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_registros_alumno_id ON public.placement_registros USING btree (alumno_id);


--
-- Name: ix_placement_registros_exam_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_registros_exam_id ON public.placement_registros USING btree (exam_id);


--
-- Name: ix_placement_registros_nivel_idioma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_placement_registros_nivel_idioma ON public.placement_registros USING btree (nivel_idioma);


--
-- Name: ix_survey_answers_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_answers_id ON public.survey_answers USING btree (id);


--
-- Name: ix_survey_answers_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_answers_question_id ON public.survey_answers USING btree (question_id);


--
-- Name: ix_survey_answers_response_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_answers_response_id ON public.survey_answers USING btree (response_id);


--
-- Name: ix_survey_categories_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_categories_id ON public.survey_categories USING btree (id);


--
-- Name: ix_survey_questions_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_questions_category_id ON public.survey_questions USING btree (category_id);


--
-- Name: ix_survey_questions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_questions_id ON public.survey_questions USING btree (id);


--
-- Name: ix_survey_responses_alumno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_responses_alumno_id ON public.survey_responses USING btree (alumno_id);


--
-- Name: ix_survey_responses_ciclo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_responses_ciclo_id ON public.survey_responses USING btree (ciclo_id);


--
-- Name: ix_survey_responses_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_responses_id ON public.survey_responses USING btree (id);


--
-- Name: ix_survey_responses_inscripcion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_survey_responses_inscripcion_id ON public.survey_responses USING btree (inscripcion_id);


--
-- Name: ix_users_curp; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_curp ON public.users USING btree (curp);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ux_insc_activa_alumno_ciclo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_insc_activa_alumno_ciclo ON public.inscripciones USING btree (alumno_id, ciclo_id) WHERE ((status)::text = ANY (ARRAY[('registrada'::character varying)::text, ('preinscrita'::character varying)::text, ('confirmada'::character varying)::text]));


--
-- Name: evaluaciones trg_evaluaciones_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evaluaciones_timestamps BEFORE INSERT OR UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.ensure_timestamps();


--
-- Name: evaluaciones trg_evaluaciones_totales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evaluaciones_totales BEFORE INSERT OR UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.evaluaciones_autocalcula_totales();


--
-- Name: evaluaciones trg_evaluaciones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evaluaciones_updated_at BEFORE UPDATE ON public.evaluaciones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asistencia_registro asistencia_registro_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro asistencia_registro_marcado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_marcado_por_id_fkey FOREIGN KEY (marcado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_registro asistencia_registro_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.asistencia_sesion(id) ON DELETE CASCADE;


--
-- Name: encuesta_docente_respuestas encuesta_docente_respuestas_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuesta_docente_respuestas
    ADD CONSTRAINT encuesta_docente_respuestas_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: encuesta_docente_respuestas encuesta_docente_respuestas_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuesta_docente_respuestas
    ADD CONSTRAINT encuesta_docente_respuestas_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: evaluaciones evaluaciones_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_registro fk_asistencia_registro_inscripcion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro fk_asistencia_registro_sesion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_sesion FOREIGN KEY (sesion_id) REFERENCES public.asistencia_sesion(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro fk_asistencia_registro_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT fk_asistencia_registro_user FOREIGN KEY (marcado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_sesion fk_asistencia_sesion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT fk_asistencia_sesion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: ciclos fk_ciclos_docente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT fk_ciclos_docente FOREIGN KEY (docente_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: evaluaciones fk_evaluacion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_inscripcion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_user FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inscripciones fk_inscripciones_validated_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT fk_inscripciones_validated_by_id_users FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grupos grupos_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_validated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_validated_by_id_fkey FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: placement_exams placement_exams_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_exams
    ADD CONSTRAINT placement_exams_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: placement_registros placement_registros_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: placement_registros placement_registros_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.placement_exams(id) ON DELETE CASCADE;


--
-- Name: placement_registros placement_registros_validated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_registros
    ADD CONSTRAINT placement_registros_validated_by_id_fkey FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: survey_answers survey_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON DELETE CASCADE;


--
-- Name: survey_answers survey_answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;


--
-- Name: survey_questions survey_questions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.survey_categories(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

